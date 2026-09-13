import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { formatDistance, formatTime, formatDateTime } from '../../utils/formatters';
import { Navigation, Clock, Gauge, Filter, AlertTriangle } from 'lucide-react';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function segmentPointsFallback(points, maxGapMeters = 1000, maxGapMinutes = 5) {
  const valid = (points || []).filter((p) => p.is_filtered === 0);
  if (valid.length === 0) return { segments: [], gaps: [] };

  const segments = [];
  const gaps = [];
  let currentSegment = [valid[0]];

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];

    const distM = haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const timeDiffMin = Math.abs(new Date(curr.recorded_at) - new Date(prev.recorded_at)) / 60000;

    if (timeDiffMin > maxGapMinutes || distM > maxGapMeters) {
      segments.push(currentSegment);
      gaps.push({
        fromPoint: prev,
        toPoint: curr,
        distanceMeters: Math.round(distM),
        timeGapMinutes: Math.round(timeDiffMin * 10) / 10
      });
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return { segments, gaps };
}

export function RoutePlaybackMap({ points = [], session = {}, segments: inputSegments, gaps: inputGaps }) {
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

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(map);

    layersGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render polyline route, gap markers, and waypoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!points || points.length === 0) return;

    // Use passed segments/gaps or compute fallback
    const { segments, gaps } = (inputSegments && inputGaps)
      ? { segments: inputSegments, gaps: inputGaps }
      : segmentPointsFallback(points);

    const validPoints = points.filter((p) => p.is_filtered === 0);
    const filteredPoints = points.filter((p) => p.is_filtered === 1);

    // 1. Draw continuous valid route segments (NEVER draw across gaps)
    segments.forEach((seg) => {
      if (seg && seg.length > 1) {
        const segLatLngs = seg.map((p) => [p.latitude, p.longitude]);

        // Outer glow
        L.polyline(segLatLngs, {
          color: '#059669',
          weight: 8,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);

        // Crisp primary route line
        L.polyline(segLatLngs, {
          color: '#10b981',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);
      }
    });

    // 2. Render Discontinuous Gaps (GPS SIGNAL GAP breaks)
    gaps.forEach((gap) => {
      if (!gap.fromPoint || !gap.toPoint) return;
      const p1 = [gap.fromPoint.latitude, gap.fromPoint.longitude];
      const p2 = [gap.toPoint.latitude, gap.toPoint.longitude];
      const midLat = (gap.fromPoint.latitude + gap.toPoint.latitude) / 2;
      const midLng = (gap.fromPoint.longitude + gap.toPoint.longitude) / 2;

      // Dashed red indicator line showing data absence
      L.polyline([p1, p2], {
        color: '#f43f5e',
        weight: 2,
        dashArray: '6, 8',
        opacity: 0.75
      }).addTo(group);

      const timeGapText = gap.timeGapMinutes ? `${gap.timeGapMinutes}m` : '';
      const distGapText = (gap.distanceMeters || gap.distanceM) ? `${Math.round((gap.distanceMeters || gap.distanceM) / 100) / 10}km` : '';

      const gapIcon = L.divIcon({
        className: 'gps-gap-marker',
        html: `
          <div style="background: rgba(225, 29, 72, 0.92); color: #fff; border: 1.5px solid #fff; border-radius: 6px; padding: 2px 6px; font-size: 9px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5); cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <span>⚠️</span> SIGNAL GAP ${timeGapText} ${distGapText}
          </div>
        `,
        iconAnchor: [55, 10]
      });

      L.marker([midLat, midLng], { icon: gapIcon })
        .addTo(group)
        .bindPopup(`
          <div style="font-size: 11px; color: #9f1239; line-height: 1.4;">
            <strong style="color: #e11d48;">⚠️ GPS SIGNAL GAP BREAK</strong><br>
            Time Gap: ~${gap.timeGapMinutes || Math.round(gap.durationMinutes || 0)} minutes<br>
            Discontinuous Distance: ~${Math.round((gap.distanceMeters || gap.distanceM || 0) / 100) / 10} km<br>
            <span style="color: #64748b;">(Excluded from continuous conveyance calculation)</span>
          </div>
        `);
    });

    // 3. Start Marker (Green Flag A)
    if (validPoints.length > 0) {
      const startPt = validPoints[0];
      const startIcon = L.divIcon({
        className: 'start-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.4); font-size: 11px; font-weight: bold;">
              A
            </div>
            <span style="background: rgba(15,23,42,0.95); color: #6ee7b7; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid #059669; white-space: nowrap;">
              START
            </span>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 24]
      });

      L.marker([startPt.latitude, startPt.longitude], { icon: startIcon })
        .addTo(group)
        .bindPopup(`<strong>START LOCATION</strong><br>Time: ${formatTime(startPt.recorded_at)}<br>Accuracy: ±${Math.round(startPt.accuracy || 10)}m`);
    }

    // 4. End / Current Marker (Red/Blue Pin B)
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
            <span style="background: rgba(15,23,42,0.95); color: ${isOngoing ? '#93c5fd' : '#fca5a5'}; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; margin-top: 2px; border: 1px solid ${endColor}; white-space: nowrap;">
              ${label}
            </span>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 24]
      });

      L.marker([endPt.latitude, endPt.longitude], { icon: endIcon })
        .addTo(group)
        .bindPopup(`<strong>${label} LOCATION</strong><br>Time: ${formatTime(endPt.recorded_at)}<br>Accuracy: ±${Math.round(endPt.accuracy || 10)}m`);
    }

    // 5. Intermediate Waypoint Dots
    for (let i = 1; i < validPoints.length - 1; i++) {
      const pt = validPoints[i];
      const circle = L.circleMarker([pt.latitude, pt.longitude], {
        radius: 3.5,
        color: '#047857',
        fillColor: '#34d399',
        fillOpacity: 0.85,
        weight: 1.5
      }).addTo(group);

      circle.on('click', () => setSelectedPoint(pt));
    }

    // 6. Filtered / Rejected Glitch Points (when toggled)
    if (showFiltered && filteredPoints.length > 0) {
      filteredPoints.forEach((pt) => {
        const glitchMarker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 5.5,
          color: '#e11d48',
          fillColor: '#fda4af',
          fillOpacity: 0.8,
          weight: 2,
          dashArray: '2,2'
        }).addTo(group);

        const reason = pt.filter_reason || 'NOISE_FILTERED';

        glitchMarker.bindPopup(`
          <div style="font-size: 11px; color: #9f1239; line-height: 1.4;">
            <strong style="color: #e11d48;">REJECTED GPS GLITCH</strong><br>
            Reason: <strong>${reason}</strong><br>
            Accuracy: ±${Math.round(pt.accuracy || 0)}m<br>
            Speed: ${pt.speed ? `${Math.round(pt.speed)} km/h` : 'N/A'}<br>
            Provider: ${pt.provider || 'N/A'}<br>
            Time: ${formatTime(pt.recorded_at)}
          </div>
        `);
      });
    }

    // Fit map bounds
    if (validPoints.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, session, inputSegments, inputGaps, showFiltered]);

  const validCount = points.filter((p) => p.is_filtered === 0).length;
  const filteredCount = points.filter((p) => p.is_filtered === 1).length;

  return (
    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl flex flex-col">
      {/* Route Info Header */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow text-xs text-white">
        <span className="font-semibold flex items-center gap-1 text-emerald-400">
          <Navigation className="w-3.5 h-3.5" />
          Accurate Route
        </span>
        <span className="text-slate-400 border-l border-slate-700 pl-2">
          GPS Distance: <strong className="text-white">{formatDistance(session?.gps_distance_km)}</strong>
        </span>
        <span className="text-slate-400 border-l border-slate-700 pl-2">
          Valid Points: <strong className="text-emerald-400 font-mono">{validCount}</strong>
        </span>

        {/* Signal Gaps Indicator */}
        {(inputGaps?.length > 0) && (
          <span className="text-rose-400 border-l border-slate-700 pl-2 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            {inputGaps.length} Signal {inputGaps.length === 1 ? 'Gap' : 'Gaps'}
          </span>
        )}

        {/* Toggle Filtered Glitches */}
        {filteredCount > 0 && (
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
            <span>{showFiltered ? 'Hide Noise' : `Show Noise (${filteredCount})`}</span>
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
            Accuracy: ±{Math.round(selectedPoint.accuracy || 10)}m | Provider: {selectedPoint.provider || 'gps'}
          </div>
        </div>
      )}
    </div>
  );
}
