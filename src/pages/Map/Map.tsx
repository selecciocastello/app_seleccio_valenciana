import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CustomSelect } from '../../components/ui/Select';
import { useAppStore } from '../../hooks/useAppStore';
import { useAuth } from '../../contexts/AuthContext';
import { Users, CalendarDays, Check, MapPinned, Route, Plus, X } from 'lucide-react';
import L from 'leaflet';
import { isTodayOrFuture } from '../../utils/dateFilters';

// Distància en línia recta entre dos punts (fórmula de Haversine), en km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export const MatchMap: React.FC = () => {
  const { matches, agenda, addToAgenda, getTeamPlayersBreakdown } = useAppStore();
  const { user } = useAuth();
  const currentSelectorName = user?.full_name || 'Seleccionador';

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  // --- Planificació per proximitat ---
  const [planFrom, setPlanFrom] = useState('09:00');
  const [planTo, setPlanTo] = useState('22:00');
  const [planMaxKm, setPlanMaxKm] = useState('15');
  const [planOrigin, setPlanOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const viewRef = useRef<{ center: [number, number]; zoom: number }>({ center: [39.986, -0.051], zoom: 11 });

  // Equipos que realmente juegan algún partido, extraídos directament dels propis partits
  // (l'id d'equip que ve del scraping no sempre coincideix amb el id de l'objecte Team)
  const teamsWithMatches = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach((m) => {
      if (m.home_team_id && (m.home_team_name || m.home_team?.name)) {
        map.set(m.home_team_id, m.home_team_name || m.home_team!.name);
      }
      if (m.away_team_id && (m.away_team_name || m.away_team?.name)) {
        map.set(m.away_team_id, m.away_team_name || m.away_team!.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  const selectedTeam = teamsWithMatches.find((t) => t.id === selectedTeamId);

  // Filtrar partidos si se ha seleccionado un equipo específico
  const teamFilteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedTeamId !== 'all') {
        return m.home_team_id === selectedTeamId || m.away_team_id === selectedTeamId;
      }
      return true;
    });
  }, [matches, selectedTeamId]);

  // Días disponibles (a partir de los partidos ya filtrados por equipo, solo hoy o futuro)
  const availableDays = useMemo(() => {
    const set = new Set<string>();
    teamFilteredMatches.forEach((m) => {
      if (m.match_date && isTodayOrFuture(m.match_date)) set.add(m.match_date.slice(0, 10));
    });
    return Array.from(set).sort();
  }, [teamFilteredMatches]);

  // Mantener siempre un día concreto seleccionado (el primero disponible por defecto)
  useEffect(() => {
    if (availableDays.length === 0) {
      if (selectedDay !== '') setSelectedDay('');
      return;
    }
    if (!availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0]);
    }
  }, [availableDays, selectedDay]);

  const filteredMatches = useMemo(() => {
    if (!selectedDay) return [];
    return teamFilteredMatches.filter((m) => m.match_date?.slice(0, 10) === selectedDay);
  }, [teamFilteredMatches, selectedDay]);

  const getMatchTime = (m: (typeof matches)[number]) => {
    if (m.match_time) return m.match_time.slice(0, 5);
    if (m.time) return m.time;
    return '';
  };

  // Partidos del día seleccionado dentro de la franja horaria indicada, con distancia calculada
  const planResults = useMemo(() => {
    if (!planOrigin) return [];
    const fromMin = timeToMinutes(planFrom);
    const toMin = timeToMinutes(planTo);
    const maxKm = planMaxKm ? parseFloat(planMaxKm) : null;

    return filteredMatches
      .filter((m) => m.latitude && m.longitude)
      .map((m) => ({
        match: m,
        distanceKm: haversineKm(planOrigin.lat, planOrigin.lng, m.latitude as number, m.longitude as number)
      }))
      .filter((r) => {
        const time = getMatchTime(r.match);
        if (time) {
          const matchMin = timeToMinutes(time);
          if (matchMin < fromMin || matchMin > toMin) return false;
        }
        if (maxKm != null && !isNaN(maxKm) && r.distanceKm > maxKm) return false;
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [filteredMatches, planOrigin, planFrom, planTo, planMaxKm]);

  const isInAgenda = (matchId: string) => agenda.some((a) => a.match_id === matchId);

  const handleAcceptPlanMatch = (match: (typeof matches)[number]) => {
    addToAgenda(match, currentSelectorName);
    setToast(`Afegit a l'agenda: ${match.home_team_name || match.home_team?.name} vs ${match.away_team_name || match.away_team?.name}`);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Inicializar mapa de Leaflet
    const mapContainer = document.getElementById('leaflet-map');
    if (!mapContainer) return;

    // Limpiar container previo si ya existía Leaflet instance
    (mapContainer as any)._leaflet_id = null;

    const map = L.map('leaflet-map').setView(viewRef.current.center, viewRef.current.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Fer clic en el mapa marca la ubicació des d'on es vol planificar
    map.on('click', (e: L.LeafletMouseEvent) => {
      setPlanOrigin({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Punt d'origen seleccionat + radi de cerca en km
    if (planOrigin) {
      const originIcon = L.divIcon({
        className: 'custom-origin-marker',
        html: `
          <div style="width:20px;height:20px;border-radius:50%;background:#061338;border:3px solid #fff;box-shadow:0 0 0 3px #061338, 0 2px 8px rgba(0,0,0,0.5);"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([planOrigin.lat, planOrigin.lng], { icon: originIcon }).addTo(map).bindTooltip('La teua ubicació', {
        permanent: false,
        direction: 'top'
      });

      const km = parseFloat(planMaxKm);
      if (!isNaN(km) && km > 0) {
        L.circle([planOrigin.lat, planOrigin.lng], {
          radius: km * 1000,
          color: '#ff6600',
          weight: 2,
          fillColor: '#ff6600',
          fillOpacity: 0.08
        }).addTo(map);
      }
    }

    // Agrupar partidos por ubicación (lat/lng redondeada) para no solapar marcadores
    const locationGroups = new Map<string, typeof filteredMatches>();
    filteredMatches.forEach((match) => {
      if (match.latitude && match.longitude) {
        const key = `${Number(match.latitude).toFixed(4)},${Number(match.longitude).toFixed(4)}`;
        const group = locationGroups.get(key) || [];
        group.push(match);
        locationGroups.set(key, group);
      }
    });

    const bounds = L.latLngBounds([]);

    locationGroups.forEach((matchesAtLocation) => {
      const lat = matchesAtLocation[0].latitude;
      const lng = matchesAtLocation[0].longitude;
      if (lat == null || lng == null) return;

      bounds.extend([lat, lng]);

      const fieldName = matchesAtLocation[0].field_name || 'Camp Municipal';
      const shortField = fieldName.replace(/Campo\s*\d+|F-11|Castellón|Vila-real|Campo\s*[A-Z]/gi, '').trim().slice(0, 18);

      // Icono personalizado: escut + badges (roig = 2n any, verd = 1r any)
      const crestHtml = (crestUrl: string | undefined, teamName: string | undefined) => {
        const breakdown = teamName ? getTeamPlayersBreakdown(teamName) : { secondYear: 0, firstYear: 0 };
        const badge = (count: number, color: string) =>
          count > 0
            ? `<span style="position:absolute; ${color === '#dc2626' ? 'top:-4px; right:-4px;' : 'bottom:-4px; right:-4px;'} background:${color}; color:#fff; font-size:8px; font-weight:900; min-width:12px; height:12px; padding:0 2px; border-radius:999px; display:flex; align-items:center; justify-content:center; border:1px solid #fff; line-height:1; box-shadow:0 1px 2px rgba(0,0,0,0.4);">${count}</span>`
            : '';
        return `
          <div style="position:relative; width:22px; height:22px; flex-shrink:0;">
            <div style="width:22px;height:22px;border-radius:50%;background:#fff;border:1.5px solid #061338;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
              ${crestUrl ? `<img src="${crestUrl}" style="width:16px;height:16px;object-fit:contain;" />` : `<span style="font-size:10px;">⚽</span>`}
            </div>
            ${badge(breakdown.secondYear, '#dc2626')}
            ${badge(breakdown.firstYear, '#16a34a')}
          </div>
        `;
      };

      let markerHtml = '';

      if (matchesAtLocation.length === 1) {
        const match = matchesAtLocation[0];
        const homeCrest = match.home_crest || match.home_team?.crest_url;
        const awayCrest = match.away_crest || match.away_team?.crest_url;
        const time = getMatchTime(match);
        markerHtml = `
          <div style="display:flex; align-items:center; gap:4px; background:#fff; border-radius:999px; padding:3px 6px; box-shadow:0 3px 10px rgba(0,0,0,0.3); border:2px solid #ff6600; cursor:pointer; transform:translate(-50%, -50%); transition:transform 0.15s ease;" class="hover:scale-105">
            ${crestHtml(homeCrest, match.home_team_name || match.home_team?.name)}
            <span style="font-size:8.5px; font-weight:900; color:#64748b; margin:0 1px;">vs</span>
            ${crestHtml(awayCrest, match.away_team_name || match.away_team?.name)}
            ${time ? `<span style="font-size:8px; font-weight:900; background:#061338; color:#fff; padding:1px 4px; border-radius:999px; margin-left:2px;">${time}h</span>` : ''}
          </div>
        `;
      } else {
        // Multi-partit al mateix camp: marcador compacte i elegant amb comptador
        const count = matchesAtLocation.length;
        const firstMatch = matchesAtLocation[0];
        const homeCrest = firstMatch.home_crest || firstMatch.home_team?.crest_url;
        const awayCrest = firstMatch.away_crest || firstMatch.away_team?.crest_url;
        markerHtml = `
          <div style="display:flex; align-items:center; gap:6px; background:#061338; color:#fff; border-radius:999px; padding:3px 8px 3px 5px; box-shadow:0 4px 12px rgba(6,19,56,0.5); border:2px solid #ff6600; cursor:pointer; transform:translate(-50%, -50%); transition:transform 0.15s ease;" class="hover:scale-105">
            <div style="display:flex; align-items:center; gap:-6px;">
              ${homeCrest ? `<img src="${homeCrest}" style="width:18px;height:18px;object-fit:contain;border-radius:50%;background:#fff;padding:1px;" />` : ''}
              ${awayCrest ? `<img src="${awayCrest}" style="width:18px;height:18px;object-fit:contain;border-radius:50%;background:#fff;padding:1px;margin-left:-4px;" />` : ''}
            </div>
            <div style="display:flex; flex-direction:column; line-height:1.1;">
              <span style="font-size:8.5px; font-weight:800; color:#f8fafc; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${shortField || 'Camp'}</span>
            </div>
            <span style="background:#ff6600; color:#fff; font-size:9px; font-weight:900; padding:1px 6px; border-radius:999px; margin-left:2px; box-shadow:0 1px 3px rgba(0,0,0,0.3);">${count} partits</span>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: 'custom-crest-marker',
        html: markerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Contenidor del popup construït amb DOM real per poder afegir el botó "Afegir a l'agenda"
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'font-family: sans-serif; padding: 4px; min-width: 230px; max-height: 320px; overflow-y: auto;';

      const fieldLabel = document.createElement('div');
      fieldLabel.style.cssText = 'text-align:center; font-size:11px; color:#475569; margin-bottom:4px;';
      fieldLabel.textContent = `📍 ${matchesAtLocation[0].field_name || 'Camp Municipal'}`;
      popupEl.appendChild(fieldLabel);

      matchesAtLocation.forEach((match, idx) => {
        const homeCrest = match.home_crest || match.home_team?.crest_url;
        const awayCrest = match.away_crest || match.away_team?.crest_url;
        const league = `${match.competition_name || 'Lliga FFCV'}${match.group_name ? ` · ${match.group_name}` : ''}`;
        const time = getMatchTime(match);
        const dateLabel = new Date(match.match_date).toLocaleDateString('ca-ES', {
          day: '2-digit',
          month: '2-digit'
        });

        const row = document.createElement('div');
        row.style.cssText = `padding:7px 0; ${idx < matchesAtLocation.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}`;

        const teamsRow = document.createElement('div');
        teamsRow.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:4px;';
        teamsRow.innerHTML = `
          ${homeCrest ? `<img src="${homeCrest}" style="width:26px;height:26px;object-fit:contain;" />` : ''}
          <b style="color:#0f172a; font-size:11.5px; text-align:center;">${match.home_team_name || match.home_team?.name} vs ${match.away_team_name || match.away_team?.name}</b>
          ${awayCrest ? `<img src="${awayCrest}" style="width:26px;height:26px;object-fit:contain;" />` : ''}
        `;
        row.appendChild(teamsRow);

        const leagueEl = document.createElement('div');
        leagueEl.style.cssText = 'text-align:center; font-size:10px; color:#ff6600; font-weight:bold; text-transform:uppercase;';
        leagueEl.textContent = league;
        row.appendChild(leagueEl);

        const dateEl = document.createElement('div');
        dateEl.style.cssText = 'text-align:center; font-size:11px; color:#059669; font-weight:bold; margin-top:2px;';
        dateEl.textContent = `📅 ${dateLabel}${time ? ` · 🕐 ${time}h` : ''}`;
        row.appendChild(dateEl);

        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'margin-top:6px; text-align:center;';

        const already = agenda.some((a) => a.match_id === match.id);
        if (already) {
          const doneEl = document.createElement('span');
          doneEl.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; color:#059669;';
          doneEl.textContent = '✓ A l\'agenda del seleccionador';
          actionWrap.appendChild(doneEl);
        } else {
          const btn = document.createElement('button');
          btn.textContent = '+ Afegir a l\'agenda del seleccionador';
          btn.style.cssText = 'background:#ff6600; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:10.5px; font-weight:800; cursor:pointer;';
          btn.onclick = () => {
            addToAgenda(match, currentSelectorName);
            setToast(`Afegit a l'agenda: ${match.home_team_name || match.home_team?.name} vs ${match.away_team_name || match.away_team?.name}`);
            setTimeout(() => setToast(null), 3000);
            btn.disabled = true;
            btn.textContent = '✓ Afegit';
            btn.style.background = '#059669';
          };
          actionWrap.appendChild(btn);
        }
        row.appendChild(actionWrap);

        popupEl.appendChild(row);
      });

      marker.bindPopup(popupEl);
    });

    if (bounds.isValid() && locationGroups.size > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }

    return () => {
      viewRef.current = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() };
      map.remove();
    };
  }, [filteredMatches, agenda, addToAgenda, currentSelectorName, getTeamPlayersBreakdown, planOrigin, planMaxKm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">
          Mapa de Partits i Camps de Castelló
        </h1>
        <p className="text-xs font-semibold text-slate-600 mt-1">
          Ubicació geogràfica de trobades dels equips de la nostra selecció
        </p>
      </div>

      {/* Selectores de Equipo y Día */}
      <Card className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0">
            <Users className="w-4 h-4 text-[#ff6600]" />
            <span>Equip:</span>
          </div>
          <div className="flex-1 max-w-md">
            <CustomSelect
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              searchable={true}
              searchPlaceholder="Cercar equip..."
              options={[
                { value: 'all', label: 'Tots els equips i partits' },
                ...teamsWithMatches.map((t) => ({
                  value: t.id,
                  label: t.name,
                })),
              ]}
            />
          </div>

          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0 lg:ml-4">
            <CalendarDays className="w-4 h-4 text-[#ff6600]" />
            <span>Dia:</span>
          </div>
          <div className="flex-1 max-w-md flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const idx = availableDays.indexOf(selectedDay);
                if (idx > 0) setSelectedDay(availableDays[idx - 1]);
              }}
              disabled={availableDays.indexOf(selectedDay) <= 0}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <div className="flex-1">
              <CustomSelect
                value={selectedDay}
                onChange={setSelectedDay}
                options={availableDays.map((d) => ({
                  value: d,
                  label: new Date(d).toLocaleDateString('ca-ES', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }),
                }))}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const idx = availableDays.indexOf(selectedDay);
                if (idx >= 0 && idx < availableDays.length - 1) setSelectedDay(availableDays[idx + 1]);
              }}
              disabled={availableDays.indexOf(selectedDay) === availableDays.length - 1}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>

        {selectedTeam && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
            <span>
              Mostrant partits de l'equip: <strong>{selectedTeam.name}</strong>
            </span>
            <Badge variant="success">Filtre Actiu</Badge>
          </div>
        )}
      </Card>

      {/* Mapa a todo lo ancho */}
      <Card className="overflow-hidden border border-slate-800 h-[640px] relative">
        <div id="leaflet-map" className="w-full h-full z-10" />

        {/* Leyenda de años */}
        <div className="absolute bottom-4 right-4 z-[999] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">Jugadors per equip</p>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#dc2626] shrink-0" />
            <span className="text-[10.5px] font-semibold text-slate-700">2n any</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#16a34a] shrink-0" />
            <span className="text-[10.5px] font-semibold text-slate-700">1r any</span>
          </div>
        </div>
      </Card>

      {/* Planificació per proximitat */}
      <Card className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Route className="w-4 h-4 text-[#ff6600]" />
          <span>Planificació per proximitat</span>
        </div>

        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 font-semibold flex items-center gap-2">
          <MapPinned className="w-4 h-4 shrink-0" />
          <span>Fes clic en qualsevol punt del mapa per marcar on estaràs. Es dibuixarà un cercle amb el radi indicat.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Des de</label>
            <input
              type="time"
              value={planFrom}
              onChange={(e) => setPlanFrom(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600]/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Fins a</label>
            <input
              type="time"
              value={planTo}
              onChange={(e) => setPlanTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600]/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Radi de cerca (km)</label>
            <input
              type="number"
              min={0}
              value={planMaxKm}
              onChange={(e) => setPlanMaxKm(e.target.value)}
              placeholder="Ex: 15"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600]/30"
            />
          </div>

          <button
            type="button"
            onClick={() => setPlanOrigin(null)}
            disabled={!planOrigin}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Netejar punt</span>
          </button>
        </div>

        {planOrigin && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700">
                Partits dins de {planMaxKm || '∞'} km entre {planFrom}h i {planTo}h ({planResults.length})
              </p>
            </div>

            {planResults.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No hi ha partits d'este dia que encaixen amb els filtres indicats.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {planResults.map(({ match, distanceKm }) => {
                  const homeCrest = match.home_crest || match.home_team?.crest_url;
                  const awayCrest = match.away_crest || match.away_team?.crest_url;
                  const added = isInAgenda(match.id);
                  const time = getMatchTime(match);

                  return (
                    <div key={match.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="info">{match.competition_name || 'Lliga FFCV'}{match.group_name ? ` · ${match.group_name}` : ''}</Badge>
                        <span className="text-[10px] font-black text-[#ff6600] bg-orange-100 px-2 py-0.5 rounded-full">
                          {distanceKm.toFixed(1)} km
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        {homeCrest ? (
                          <img src={homeCrest} alt="" className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                        )}
                        <h4 className="text-[11px] font-bold text-slate-800 text-center flex-1 line-clamp-2">
                          {match.home_team_name || match.home_team?.name} vs {match.away_team_name || match.away_team?.name}
                        </h4>
                        {awayCrest ? (
                          <img src={awayCrest} alt="" className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                        )}
                      </div>

                      <p className="text-[10.5px] text-slate-500 text-center">
                        {time ? `🕐 ${time}h · ` : ''}
                        {match.field_name} ({match.city})
                      </p>

                      {added ? (
                        <span className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600 py-1.5">
                          <Check className="w-3.5 h-3.5" /> A l'agenda
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcceptPlanMatch(match)}
                          className="w-full py-2 bg-[#061338] hover:bg-[#ff6600] text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Acceptar i afegir a l'agenda</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
