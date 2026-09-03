import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api, getToken } from '../../api/client';
import { formatCurrency, formatDistance, formatTime } from '../../utils/formatters';
import { Users, Navigation, AlertCircle, RefreshCw, ZoomIn } from 'lucide-react';

export function LiveTrackingMap({ onSelectSupervisor, selectedSupervisorId }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());

  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Fetch live supervisors
  const fetchLive = async () => {
    try {
      const data = await api.tracking.getLive();
      setSupervisors(data.supervisors || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch live tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.0760, 72.8777], // Default center (Mumbai/India)
      zoom: 12,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // OpenStreetMap tile layer (dark theme friendly / clean carto style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Poll periodically + listen to Server-Sent Events (SSE)
  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 10000); // 10s poll

    // SSE connection
    let eventSource = null;
    const token = getToken();
    if (token) {
      try {
        eventSource = new EventSource(api.tracking.getStreamUrl());
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'LOCATION_UPDATE') {
              fetchLive(); // Refresh immediately on push
            }
          } catch (e) {}
        };
      } catch (err) {
        console.warn('SSE stream error:', err);
      }
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, []);

  // Update map markers when supervisors change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkers = markersRef.current;
    const bounds = L.latLngBounds([]);
    let hasValidBounds = false;

    supervisors.forEach((sup) => {
      const loc = sup.lastLocation;
      if (!loc || !loc.latitude || !loc.longitude) return;

      const latLng = [loc.latitude, loc.longitude];
      bounds.extend(latLng);
      hasValidBounds = true;

      // Custom pulsing SVG icon
      const isStale = sup.isStale;
      const markerColor = isStale ? '#f59e0b' : '#10b981'; // Amber if stale, Emerald if live

      const customIcon = L.divIcon({
        className: 'custom-supervisor-marker',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: ${markerColor}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #0f172a; border: 3px solid ${markerColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${markerColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
            </div>
            <div style="position: absolute; bottom: -18px; white-space: nowrap; background: rgba(15, 23, 42, 0.9); color: #f8fafc; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; border: 1px solid #334155;">
              ${sup.employee_id}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });

      // Popup Content
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 220px; color: #0f172a; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <div>
              <div style="font-weight: 700; font-size: 14px;">${sup.name}</div>
              <div style="font-size: 11px; color: #64748b; font-family: monospace;">${sup.employee_id}</div>
            </div>
            <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 9999px; background: ${isStale ? '#fef3c7' : '#dcfce7'}; color: ${isStale ? '#b45309' : '#15803d'};">
              ${isStale ? 'STALE' : 'LIVE'}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px;">
            <div>
              <span style="color: #64748b; display: block;">Duty Start:</span>
              <strong>${formatTime(sup.start_time)}</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block;">Start KM:</span>
              <strong>${sup.start_km ?? 'N/A'}</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block;">Distance:</span>
              <strong style="color: #059669;">${formatDistance(sup.gps_distance_km)}</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block;">Conveyance:</span>
              <strong style="color: #2563eb;">${formatCurrency(sup.currentConveyance)}</strong>
            </div>
          </div>

          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <div>Accuracy: ±${Math.round(loc.accuracy || 10)}m</div>
            <div>Last update: ${sup.minutesSinceLastUpdate != null ? `${sup.minutesSinceLastUpdate} mins ago` : 'Just now'}</div>
          </div>
        </div>
      `;

      if (currentMarkers.has(sup.supervisor_id)) {
        const marker = currentMarkers.get(sup.supervisor_id);
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
        marker.setPopupContent(popupHtml);
      } else {
        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupHtml);
        marker.on('click', () => {
          if (onSelectSupervisor) onSelectSupervisor(sup);
        });
        currentMarkers.set(sup.supervisor_id, marker);
      }
    });

    // Remove old markers
    const currentIds = new Set(supervisors.map((s) => s.supervisor_id));
    for (const [id, marker] of currentMarkers.entries()) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        currentMarkers.delete(id);
      }
    }

    // Auto fit bounds on initial load if we have supervisors
    if (hasValidBounds && !selectedSupervisorId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [supervisors, selectedSupervisorId, onSelectSupervisor]);

  // If a specific supervisor is selected from the sidebar, zoom to them
  useEffect(() => {
    if (!selectedSupervisorId || !mapInstanceRef.current) return;
    const sup = supervisors.find((s) => s.supervisor_id === selectedSupervisorId);
    if (sup?.lastLocation?.latitude) {
      mapInstanceRef.current.flyTo([sup.lastLocation.latitude, sup.lastLocation.longitude], 15, { duration: 1.2 });
      const marker = markersRef.current.get(selectedSupervisorId);
      if (marker) marker.openPopup();
    }
  }, [selectedSupervisorId, supervisors]);

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Map Header Bar */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg text-white">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold tracking-wide uppercase">Live Supervisor Map</span>
        <span className="text-xs text-slate-400 border-l border-slate-700 pl-2">
          {supervisors.length} on duty
        </span>
        <button
          onClick={fetchLive}
          title="Refresh Locations"
          className="ml-2 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" />

      {/* Empty State Overlay */}
      {supervisors.length === 0 && !loading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-300 shadow-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>No supervisors currently on duty.</span>
        </div>
      )}
    </div>
  );
}
