import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { formatDistance, formatTime, formatDateTime } from '../../utils/formatters';
import { MapPin, Navigation, Clock, Gauge, Filter } from 'lucide-react';

export function RoutePlaybackMap({ points = [], session = {} }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  const [showFiltered, setShowFiltered] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.0760, 72.8777],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    layersGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render polyline route and markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!points || points.length === 0) return;

    // Filter valid vs noise points
    const validPoints = points.filter((p) => p.is_filtered === 0);
    const filteredPoints = points.filter((p) => p.is_filtered === 1);

    const latLngs = validPoints.map((p) => [p.latitude, p.longitude]);

    // 1. Draw Route Polyline
    if (latLngs.length > 1) {
      // Glow underlay
      L.polyline(latLngs, {
        color: '#059669',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(group);

      // Primary crisp route polyline
      L.polyline(latLngs, {
        color: '#10b981',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(group);
    }

    // 2. Start Marker (Green Flag)
    if (validPoints.length > 0) {
      const startPt = validPoints[0];
      const startIcon = L.divIcon({
        className: 'start-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); font-size: 11px; font-weight: bold;">
              A
            </div>
            <span style="background: rgba(15,23,42,0.9); color: #6ee7b7; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid #059669; white-space: nowrap;">
              START
            </span>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 24]
      });

      L.marker([startPt.latitude, startPt.longitude], { icon: startIcon })
        .addTo(group)
        .bindPopup(`<strong>START LOCATION</strong><br>Time: ${formatTime(startPt.recorded_at)}`);
    }

    // 3. End / Current Marker (Red/Amber Pin)
    if (validPoints.length > 1) {
      const endPt = validPoints[validPoints.length - 1];
      const isOngoing = session?.status === 'ON_DUTY';
      const endColor = isOngoing ? '#3b82f6' : '#ef4444';
      const label = isOngoing ? 'CURRENT' : 'END';

      const endIcon = L.divIcon({
        className: 'end-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background: ${endColor}; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); font-size: 11px; font-weight: bold;">
              B
            </div>
            <span style="background: rgba(15,23,42,0.9); color: ${isOngoing ? '#93c5fd' : '#fca5a5'}; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid ${endColor}; white-space: nowrap;">
              ${label}
            </span>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 24]
      });

      L.marker([endPt.latitude, endPt.longitude], { icon: endIcon })
        .addTo(group)
        .bindPopup(`<strong>${label} LOCATION</strong><br>Time: ${formatTime(endPt.recorded_at)}`);
    }

    // 4. Intermediate waypoints
    for (let i = 1; i < validPoints.length - 1; i++) {
      const pt = validPoints[i];
      const circle = L.circleMarker([pt.latitude, pt.longitude], {
        radius: 4,
        color: '#047857',
        fillColor: '#34d399',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(group);

      circle.on('click', () => setSelectedPoint(pt));
    }

    // 5. Filtered/Glitch points (if toggled)
    if (showFiltered && filteredPoints.length > 0) {
      filteredPoints.forEach((pt) => {
        const glitchMarker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          color: '#e11d48',
          fillColor: '#fda4af',
          fillOpacity: 0.7,
          weight: 2,
          dashArray: '3,3'
        }).addTo(group);

        glitchMarker.bindPopup(`
          <div style="font-size: 11px; color: #9f1239;">
            <strong>FILTERED GPS GLITCH</strong><br>
            Accuracy: ±${pt.accuracy}m<br>
            Speed: ${pt.speed ? `${Math.round(pt.speed)} km/h` : 'N/A'}<br>
            Time: ${formatTime(pt.recorded_at)}
          </div>
        `);
      });
    }

    // Fit map bounds
    if (latLngs.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, session, showFiltered]);

  return (
    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl flex flex-col">
      {/* Route Info Header */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow text-xs text-white">
        <span className="font-semibold flex items-center gap-1 text-emerald-400">
          <Navigation className="w-3.5 h-3.5" />
          Route Track
        </span>
        <span className="text-slate-400 border-l border-slate-700 pl-2">
          GPS Distance: <strong className="text-white">{formatDistance(session?.gps_distance_km)}</strong>
        </span>
        <span className="text-slate-400 border-l border-slate-700 pl-2">
          Points: <strong className="text-white">{points.filter((p) => p.is_filtered === 0).length}</strong>
        </span>

        {/* Toggle Filtered Glitches */}
        {points.some((p) => p.is_filtered === 1) && (
          <button
            type="button"
            onClick={() => setShowFiltered(!showFiltered)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ml-1 transition ${
              showFiltered
                ? 'bg-rose-950 border-rose-500 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>{showFiltered ? 'Hide Noise' : 'Show Noise'}</span>
          </button>
        )}
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" />

      {/* Waypoint Inspector Box */}
      {selectedPoint && (
        <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl text-xs text-slate-200 flex flex-col gap-1 min-w-[200px]">
          <div className="flex items-center justify-between font-semibold text-emerald-400">
            <span>Waypoint Details</span>
            <button onClick={() => setSelectedPoint(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDateTime(selectedPoint.recorded_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>Speed: {selectedPoint.speed ? `${Math.round(selectedPoint.speed)} km/h` : 'N/A'}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Accuracy: ±{Math.round(selectedPoint.accuracy || 10)}m
          </div>
        </div>
      )}
    </div>
  );
}
