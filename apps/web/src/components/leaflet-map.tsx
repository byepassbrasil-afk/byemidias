'use client';

import { useEffect, useRef } from 'react';

export interface DeviceMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  partner_name?: string;
  campaign_name?: string;
}

interface LeafletMapProps {
  devices: DeviceMarker[];
  center: { latitude: number; longitude: number };
  zoom?: number;
  height?: string;
  markerColor?: string;
  onMarkerClick?: (id: string) => void;
}

declare global {
  interface Window {
    L?: any;
  }
}

export default function LeafletMap({
  devices,
  center,
  zoom = 5,
  height = '500px',
  markerColor = '#3b82f6',
  onMarkerClick,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    function initMap() {
      const L = window.L;
      if (!L) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      const map = L.map(mapRef.current).setView([center.latitude, center.longitude], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      devices.filter((d) => d.latitude && d.longitude).forEach((d) => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:${markerColor};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([d.latitude, d.longitude], { icon }).addTo(map);
        const lines: string[] = [];
        lines.push(`<strong>${escapeHtml(d.name)}</strong>`);
        if (d.address || d.city) lines.push(`${escapeHtml(d.address ?? '')} ${escapeHtml(d.city ?? '')}`);
        if (d.partner_name) lines.push(`<small>📺 ${escapeHtml(d.partner_name)}</small>`);
        if (d.campaign_name) lines.push(`<small>🎬 ${escapeHtml(d.campaign_name)}</small>`);
        marker.bindPopup(`<div style="min-width:180px">${lines.join('<br>')}</div>`);
        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(d.id));
        }
      });
      mapInstanceRef.current = map;
    }

    if (!window.L) {
      if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link');
        css.id = 'leaflet-css';
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = initMap;
      document.head.appendChild(s);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [JSON.stringify(devices), JSON.stringify(center), zoom, markerColor]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-gray-100"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] || s);
}
