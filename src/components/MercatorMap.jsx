import { useState, useEffect, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator } from '@deck.gl/core';
import { Map } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';

import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ARC_PALETTE = ['#ff6b6b', '#4fc3f7', '#ffd54f', '#69f0ae', '#ff80ab', '#c084fc'];

function getPointColor(totalDays, isGlow) {
  const alpha = isGlow ? 60 : 255;
  if (totalDays >= 365) return [0, 229, 255, alpha];
  if (totalDays >= 30) return [192, 132, 252, alpha];
  return [255, 145, 0, alpha];
}

function formatDuration(totalDays) {
  if (totalDays < 30) return `${totalDays} gün`;
  if (totalDays < 365) return `${Math.round(totalDays / 30)} ay`;
  return `${(totalDays / 365).toFixed(1)} yıl`;
}

function getPointRadius(days, isGlow) {
  const base = 3 + Math.log10(days + 1) * 1.5;
  return isGlow ? base * 2 : base;
}

const INITIAL_VIEW_STATE = {
  longitude: 35,
  latitude: 39,
  zoom: 3.5,
  pitch: 0,
  bearing: 0,
};

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, Math.round(alpha * 255)];
}

function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return [255, 255, 255];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export default function MercatorMap({
  locations,
  connections,
  arcColors,
  timelineTimestamp,
  dynamicSize,
  focusedCoords,
  onGlobeClick,
  onObjectClick,
  onArcClick,
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  useEffect(() => {
    if (focusedCoords) {
      setViewState((prev) => ({
        ...prev,
        longitude: focusedCoords.lng,
        latitude: focusedCoords.lat,
        zoom: 5,
        transitionDuration: 1500,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [focusedCoords]);

  const customData = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    const map = {};
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const visitTime = new Date(loc.visit_date).getTime();
      if (timelineTimestamp < visitTime) continue;

      const elapsedDays = Math.floor(
        (timelineTimestamp - visitTime) / (1000 * 60 * 60 * 24)
      );
      const activeDays = Math.min(elapsedDays, Number(loc.duration_days || 0));
      if (activeDays <= 0) continue;

      const key = `${lat.toFixed(6)}|${lng.toFixed(6)}`;
      if (!map[key]) {
        map[key] = { lat, lng, totalDays: 0, points: [] };
      }
      map[key].totalDays += activeDays;
      map[key].points.push({ ...loc, duration_days: activeDays });
    }

    return Object.values(map).map((slice) => ({
      ...slice,
      lat: slice.lat,
      lng: slice.lng,
    }));
  }, [locations, timelineTimestamp]);

  const arcsData = useMemo(() => {
    if (!connections || connections.length === 0) return [];
    const result = [];
    connections
      .filter(
        (c) =>
          !isNaN(Number(c.start_lat)) &&
          !isNaN(Number(c.start_lng)) &&
          !isNaN(Number(c.end_lat)) &&
          !isNaN(Number(c.end_lng))
      )
      .forEach((c) => {
        let dates = [];
        if (c.visit_dates) {
          if (Array.isArray(c.visit_dates)) dates = c.visit_dates;
          else
            try {
              dates = JSON.parse(c.visit_dates);
            } catch (_) {}
        }

        const activeDates = dates.filter(
          (d) => new Date(d).getTime() <= timelineTimestamp
        );
        if (activeDates.length === 0) return;

        activeDates.forEach((date, i) => {
          const base = {
            startLat: Number(c.start_lat),
            startLng: Number(c.start_lng),
            endLat: Number(c.end_lat),
            endLng: Number(c.end_lng),
            id: c.id + '_' + i,
            bundleOffset: i * 0.015,
            originalId: c.id,
            dates: activeDates,
          };
          result.push({ ...base, isGlow: false });
          result.push({ ...base, isGlow: true });
        });
      });
    return result;
  }, [connections, timelineTimestamp]);

  const getArcColor = useCallback(
    (arc, includeAlpha = false) => {
      const cid = arc.originalId || arc.id;
      const baseColor =
        arcColors && arcColors[cid]
          ? arcColors[cid]
          : (() => {
              const hash = Math.abs(
                arc.startLat * 1000 +
                  arc.startLng * 1000 +
                  arc.endLat * 1000 +
                  arc.endLng * 1000
              );
              return ARC_PALETTE[Math.floor(hash) % ARC_PALETTE.length];
            })();

      if (includeAlpha) return hexToRgba(baseColor, 0.15);
      return hexToRgb(baseColor);
    },
    [arcColors]
  );

  const layers = useMemo(
    () => [
      new ScatterplotLayer({
        id: 'locations-glow',
        data: customData,
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => getPointRadius(dynamicSize ? d.totalDays : 30, true),
        radiusUnits: 'pixels',
        getFillColor: (d) => getPointColor(d.totalDays, true),
        updateTriggers: {
          getFillColor: timelineTimestamp,
          getRadius: [timelineTimestamp, dynamicSize],
        },
      }),
      new ScatterplotLayer({
        id: 'locations-core',
        data: customData,
        pickable: true,
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => getPointRadius(dynamicSize ? d.totalDays : 30, false),
        radiusUnits: 'pixels',
        getFillColor: (d) => getPointColor(d.totalDays, false),
        updateTriggers: {
          getFillColor: timelineTimestamp,
          getRadius: [timelineTimestamp, dynamicSize],
        },
      }),
      new ArcLayer({
        id: 'arcs-glow',
        data: arcsData.filter((a) => a.isGlow),
        pickable: false,
        getWidth: 8,
        getSourcePosition: (d) => [d.startLng, d.startLat],
        getTargetPosition: (d) => [d.endLng, d.endLat],
        getSourceColor: (d) => getArcColor(d, true),
        getTargetColor: (d) => getArcColor(d, true),
        greatCircle: true,
        widthMinPixels: 4,
        parameters: { depthTest: false },
      }),
      new ArcLayer({
        id: 'arcs-core',
        data: arcsData.filter((a) => !a.isGlow),
        pickable: true,
        getWidth: 2,
        getSourcePosition: (d) => [d.startLng, d.startLat],
        getTargetPosition: (d) => [d.endLng, d.endLat],
        getSourceColor: (d) => getArcColor(d, false),
        getTargetColor: (d) => getArcColor(d, false),
        greatCircle: true,
        widthMinPixels: 1,
      }),
    ],
    [customData, arcsData, getArcColor, dynamicSize]
  );

  const handleClick = useCallback(
    (info) => {
      if (info.object) {
        if (info.layer?.id === 'locations-core' || info.layer?.id === 'locations-glow') {
          onObjectClick(info.object);
          return;
        }
        if (
          info.layer?.id === 'arcs-core' ||
          info.layer?.id === 'arcs-glow'
        ) {
          onArcClick(info.object);
          return;
        }
      }
      if (info.coordinate && onGlobeClick) {
        onGlobeClick({ lat: info.coordinate[1], lng: info.coordinate[0] });
      }
    },
    [onObjectClick, onArcClick, onGlobeClick]
  );

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState: vs }) => setViewState(vs)}
      controller={true}
      layers={layers}
      onClick={handleClick}
      getTooltip={({ object, layer }) => {
        if (!object) return null;
        if (layer?.id === 'locations-core') {
          return {
            text: formatDuration(object.totalDays),
            style: {
              backgroundColor: 'rgba(10, 15, 26, 0.9)',
              color: '#a5f3fc',
              fontSize: '11px',
              fontFamily: 'monospace',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '6px 10px',
              boxShadow: '0 0 15px rgba(0, 255, 255, 0.1)',
            },
          };
        }
        return null;
      }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      <Map reuseMaps mapLib={maplibregl} mapStyle={MAP_STYLE} />
    </DeckGL>
  );
}
