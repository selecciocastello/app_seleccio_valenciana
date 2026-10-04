import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { formatAppDate } from '../../utils/dateFormatter';

export interface RouteStop {
  id: string;
  order: number; // Número del partit a la columna (ordre cronològic)
  date: string;
  time: string;
  lat: number;
  lng: number;
  label: string;
  place?: string;
  observed: boolean;
}

/** Enllaç de Google Maps amb la ruta en cotxe entre les parades, en ordre. */
export function googleMapsRouteUrl(stops: Pick<RouteStop, 'lat' | 'lng'>[]): string {
  const point = (s: Pick<RouteStop, 'lat' | 'lng'>) => `${s.lat},${s.lng}`;
  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${point(stops[0])}&travelmode=driving`;
  }
  const waypoints = stops.slice(1, -1).map(point).join('|');
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${point(stops[0])}` +
    `&destination=${point(stops[stops.length - 1])}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
    '&travelmode=driving'
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Mapa d'una agenda: parades numerades i línia que les uneix dins de cada dia. */
export const AgendaRouteMap: React.FC<{ stops: RouteStop[] }> = ({ stops }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || stops.length === 0) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const byDay = new Map<string, RouteStop[]>();
    stops.forEach((s) => byDay.set(s.date, [...(byDay.get(s.date) || []), s]));
    byDay.forEach((dayStops) => {
      if (dayStops.length > 1) {
        L.polyline(
          dayStops.map((s) => [s.lat, s.lng] as [number, number]),
          { color: '#ff6600', weight: 3, opacity: 0.8, dashArray: '6 6' }
        ).addTo(map);
      }
    });

    const bounds = L.latLngBounds([]);
    stops.forEach((s) => {
      const bg = s.observed ? '#059669' : '#ff6600';
      const icon = L.divIcon({
        className: 'agenda-route-marker',
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:#fff;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 0 0 2px #061338,0 2px 6px rgba(0,0,0,.4);">${s.order}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const formattedDate = s.date ? formatAppDate(s.date, s.time) : '';
      L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .bindTooltip(
          `<b>${s.order}. ${escapeHtml(s.label)}</b><br/>${formattedDate}${s.place ? `<br/>${escapeHtml(s.place)}` : ''}`,
          { direction: 'top', offset: [0, -12] }
        );
      bounds.extend([s.lat, s.lng]);
    });
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });

    return () => {
      map.remove();
    };
  }, [stops]);

  if (stops.length === 0) {
    return (
      <div className="h-48 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold gap-1">
        <MapPin className="w-5 h-5" />
        Sense ubicacions per mostrar al mapa
      </div>
    );
  }

  return <div ref={containerRef} className="h-56 rounded-xl overflow-hidden border border-slate-200 z-0 relative" />;
};
