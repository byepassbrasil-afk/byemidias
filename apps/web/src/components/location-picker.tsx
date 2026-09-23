'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L?: any;
  }
}

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = '400px',
  zoom = 13,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default center: Brasilia (center of Brazil)
  const defaultCenter = { latitude: -15.7942, longitude: -47.8822 };
  const center = latitude != null && longitude != null ? { latitude, longitude } : defaultCenter;

  // Update marker when lat/lng prop changes externally
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    if (latitude != null && longitude != null) {
      const ll = [latitude, longitude];
      if (markerRef.current) {
        markerRef.current.setLatLng(ll);
      } else {
        markerRef.current = L.marker(ll, { draggable: true }).addTo(mapInstanceRef.current);
        markerRef.current.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          onChange(parseFloat(pos.lat.toFixed(7)), parseFloat(pos.lng.toFixed(7)));
        });
      }
      mapInstanceRef.current.setView(ll, zoom);
    }
  }, [latitude, longitude, zoom]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;

    function initMap() {
      const L = window.L;
      if (!L) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const map = L.map(mapRef.current).setView([center.latitude, center.longitude], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Click on map to set location
      map.on('click', (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(7));
        const lng = parseFloat(e.latlng.lng.toFixed(7));
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', (ev: any) => {
            const pos = ev.target.getLatLng();
            onChange(parseFloat(pos.lat.toFixed(7)), parseFloat(pos.lng.toFixed(7)));
          });
        }
        onChange(lat, lng);
      });

      // Add initial marker if we have coords
      if (latitude != null && longitude != null) {
        markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          onChange(parseFloat(pos.lat.toFixed(7)), parseFloat(pos.lng.toFixed(7)));
        });
      }

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
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch() {
    if (search.trim().length < 3) {
      setError('Digite pelo menos 3 caracteres');
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Endereço não encontrado');
        return;
      }
      const lat = parseFloat(json.latitude);
      const lng = parseFloat(json.longitude);
      onChange(lat, lng);
      if (mapInstanceRef.current && window.L) {
        mapInstanceRef.current.setView([lat, lng], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
          markerRef.current.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            onChange(parseFloat(pos.lat.toFixed(7)), parseFloat(pos.lng.toFixed(7)));
          });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar endereço';
      setError(msg);
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }
    setError(null);
    setSearching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lng = parseFloat(pos.coords.longitude.toFixed(7));
        onChange(lat, lng);
        if (mapInstanceRef.current && window.L) {
          mapInstanceRef.current.setView([lat, lng], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
            markerRef.current.on('dragend', (e: any) => {
              const p = e.target.getLatLng();
              onChange(parseFloat(p.lat.toFixed(7)), parseFloat(p.lng.toFixed(7)));
            });
          }
        }
        setSearching(false);
      },
      (err) => {
        setError('Não foi possível obter localização: ' + err.message);
        setSearching(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
          placeholder="🔍 Buscar endereço (ex: Av Paulista, São Paulo)"
          className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-colors"
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={searching}
          className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
        >
          {searching ? '...' : '🔍 Buscar'}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={searching}
          className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          title="Usar minha localização atual"
        >
          📍 GPS
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}

      <div className="text-xs text-gray-500">
        💡 Clique no mapa para marcar a localização, ou arraste o pino para ajustar
      </div>

      <div
        ref={mapRef}
        style={{ height }}
        className="rounded-xl overflow-hidden border border-gray-700"
      />
    </div>
  );
}
