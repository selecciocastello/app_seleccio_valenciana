import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';
import { MapPin, Trophy, Users } from 'lucide-react';
import L from 'leaflet';

export const MatchMap: React.FC = () => {
  const { matches, players } = useAppStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  // Filtrar partidos si se ha seleccionado un jugador específico
  const filteredMatches = matches.filter((m) => {
    if (selectedPlayer) {
      return m.home_team_id === selectedPlayer.team_id || m.away_team_id === selectedPlayer.team_id;
    }
    if (selectedTeamId !== 'all') {
      return m.home_team_id === selectedTeamId || m.away_team_id === selectedTeamId;
    }
    return true;
  });

  useEffect(() => {
    // Inicializar mapa de Leaflet
    const mapContainer = document.getElementById('leaflet-map');
    if (!mapContainer) return;

    // Limpiar container previo si ya existía Leaflet instance
    (mapContainer as any)._leaflet_id = null;

    const map = L.map('leaflet-map').setView([39.986, -0.051], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Añadir marcadores para cada equipo/partido
    filteredMatches.forEach((match) => {
      if (match.latitude && match.longitude) {
        const marker = L.marker([match.latitude, match.longitude]).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <b style="color: #0f172a;">${match.home_team?.name} vs ${match.away_team?.name}</b><br/>
            <span style="font-size: 11px; color: #475569;">📍 ${match.field_name || 'Campo Municipal'}</span><br/>
            <span style="font-size: 11px; color: #059669; font-weight: bold;">📅 ${new Date(match.match_date).toLocaleDateString('es-ES')}</span>
          </div>
        `);
      }
    });

    return () => {
      map.remove();
    };
  }, [filteredMatches]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">
          Mapa de Partits i Camps de Castelló
        </h1>
        <p className="text-xs text-slate-400">
          Ubicació geogràfica de trobades dels equips de la nostra selecció
        </p>
      </div>

      {/* Selector de Jugador para destacar sus partidos */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 shrink-0">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Seleccionar Jugador per a veure els seus pròxims partits:</span>
          </div>
          <select
            value={selectedPlayerId}
            onChange={(e) => {
              setSelectedPlayerId(e.target.value);
              if (e.target.value !== 'all') setSelectedTeamId('all');
            }}
            className="w-full md:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tots els jugadors i partits</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.team?.name})
              </option>
            ))}
          </select>
        </div>

        {selectedPlayer && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
            <span>
              Mostrant pròxims partits de l'equip de: <strong>{selectedPlayer.full_name}</strong> (
              {selectedPlayer.team?.name})
            </span>
            <Badge variant="success">Filtre Actiu</Badge>
          </div>
        )}
      </Card>

      {/* Grid Mapa + Lista de Partidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenedor del Mapa */}
        <Card className="lg:col-span-2 overflow-hidden border border-slate-800 h-[480px] relative">
          <div id="leaflet-map" className="w-full h-full z-10" />
        </Card>

        {/* Lista de Partidos Localizados */}
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span>Partits Cercans</span>
          </h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
            {filteredMatches.map((m) => (
              <div key={m.id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="info">Sub-16</Badge>
                  <span className="text-[10px] text-slate-400">
                    {new Date(m.match_date).toLocaleDateString('ca-ES')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">
                  {m.home_team?.name} vs {m.away_team?.name}
                </h4>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {m.field_name} ({m.city})
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
