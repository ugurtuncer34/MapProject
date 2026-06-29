import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import GlobeGl from 'react-globe.gl';

const ARC_PALETTE = ['#ff6b6b', '#4fc3f7', '#ffd54f', '#69f0ae', '#ff80ab', '#c084fc'];

function hexToRgba(hex, alpha) {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cylinderColor(totalDays) {
  if (totalDays <= 29) return '#2196f3';
  if (totalDays <= 364) return '#9c27b0';
  return '#1b5e20';
}

function createTextSprite(message) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 32;
  ctx.font = `bold ${fontSize}px monospace`;
  const textWidth = ctx.measureText(message).width;

  canvas.width = textWidth + 40;
  canvas.height = fontSize + 40;

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#a5f3fc';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(canvas.width * 0.012, canvas.height * 0.012, 1);
  return sprite;
}

function formatDuration(totalDays) {
  if (totalDays < 30) return `${totalDays} gün`;
  if (totalDays < 365) return `${Math.round(totalDays / 30)} ay`;
  return `${(totalDays / 365).toFixed(1)} yıl`;
}

export default function Globe({
  textureUrl,
  locations,
  connections,
  arcColors,
  timelineTimestamp,
  focusedCoords,
  onGlobeClick,
  onObjectClick,
  onArcClick,
  autoRotate,
}) {
  const globeRef = useRef();

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const customData = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    const map = {};
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const visitTime = new Date(loc.visit_date).getTime();
      if (timelineTimestamp < visitTime) continue;

      const elapsedDays = Math.floor((timelineTimestamp - visitTime) / (1000 * 60 * 60 * 24));
      const activeDays = Math.min(elapsedDays, Number(loc.duration_days || 0));
      if (activeDays <= 0) continue;

      const key = `${lat.toFixed(6)}|${lng.toFixed(6)}`;
      if (!map[key]) {
        map[key] = { lat, lng, totalDays: 0, points: [] };
      }
      map[key].totalDays += activeDays;
      map[key].points.push({ ...loc, duration_days: activeDays });
    }
    return Object.values(map);
  }, [locations, timelineTimestamp]);

  const customThreeObject = useCallback((slice) => {
    const { totalDays, points } = slice;

    let radialSegments, radius, baseColor, units;

    if (totalDays <= 29) {
      units = totalDays;
      radialSegments = 32;
      radius = 0.25;
      baseColor = cylinderColor(totalDays);
    } else if (totalDays <= 364) {
      units = totalDays / 30;
      radialSegments = 4;
      radius = 0.5;
      baseColor = cylinderColor(totalDays);
    } else {
      units = totalDays / 365;
      radialSegments = 6;
      radius = 1.0;
      baseColor = cylinderColor(totalDays);
    }

    const totalHeight = Math.max(units * 0.5, 0.5);
    const group = new THREE.Group();

    let currentZ = 0;
    points.forEach((point, i) => {
      const days = Number(point.duration_days || 0);

      if (!totalDays || totalDays === 0) return;

      const sliceH = (days / totalDays) * totalHeight;

      if (isNaN(sliceH) || sliceH <= 0) return;

      const geometry = new THREE.CylinderGeometry(radius, radius, sliceH, radialSegments);
      geometry.rotateX(Math.PI / 2);
      geometry.translate(0, 0, sliceH / 2);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const color = new THREE.Color(baseColor);
      color.offsetHSL(0, 0, i % 2 === 0 ? 0.12 : -0.08);

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        emissive: color,
        emissiveIntensity: 0.2,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = currentZ;
      group.add(mesh);
      currentZ += sliceH;
    });

    const cities = [...new Set(points.map((p) => p.city).filter(Boolean))];
    const labelStr = `${cities.join(', ')} (${formatDuration(totalDays)})`;
    const sprite = createTextSprite(labelStr);

    sprite.position.z = currentZ + 1.5;
    group.add(sprite);

    return group;
  }, []);

  const arcsData = useMemo(() => {
    if (!connections || connections.length === 0) return [];
    const result = [];
    connections
      .filter(c =>
        !isNaN(Number(c.start_lat)) && !isNaN(Number(c.start_lng)) &&
        !isNaN(Number(c.end_lat)) && !isNaN(Number(c.end_lng))
      )
      .forEach((c) => {
        let dates = [];
        if (c.visit_dates) {
          if (Array.isArray(c.visit_dates)) dates = c.visit_dates;
          else try { dates = JSON.parse(c.visit_dates); } catch (_) {}
        }

        const activeDates = dates.filter(d => new Date(d).getTime() <= timelineTimestamp);
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

  const arcColor = useCallback(
    (arc) => {
      const cid = arc.originalId || arc.id;
      if (arc.isGlow) {
        const baseColor = (arcColors && arcColors[cid])
          ? arcColors[cid]
          : (() => {
              const hash = Math.abs(
                (arc.startLat * 1000 + arc.startLng * 1000 +
                 arc.endLat * 1000 + arc.endLng * 1000)
              );
              return ARC_PALETTE[Math.floor(hash) % ARC_PALETTE.length];
            })();
        return hexToRgba(baseColor, 0.15);
      }
      if (arcColors && arcColors[cid]) return arcColors[cid];
      const hash = Math.abs(
        (arc.startLat * 1000 + arc.startLng * 1000 +
         arc.endLat * 1000 + arc.endLng * 1000)
      );
      return ARC_PALETTE[Math.floor(hash) % ARC_PALETTE.length];
    },
    [arcColors]
  );

  const arcAltitude = useCallback((arc) => {
    const dLat = (arc.endLat - arc.startLat) * Math.PI / 180;
    const dLng = (arc.endLng - arc.startLng) * Math.PI / 180;
    const lat1 = arc.startLat * Math.PI / 180;
    const lat2 = arc.endLat * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const safeA = Math.min(Math.max(a, 0), 1);
    const dist = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
    const baseAlt = Math.max(0.08, dist * 0.25);
    return baseAlt + (arc.bundleOffset || 0);
  }, []);

  useEffect(() => {
    if (focusedCoords && globeRef.current) {
      globeRef.current.pointOfView({ lat: focusedCoords.lat, lng: focusedCoords.lng, altitude: 0.4 }, 1500);
    }
  }, [focusedCoords]);

  useEffect(() => {
    const globe = globeRef.current;
    if (globe && globe.controls()) {
      globe.controls().autoRotate = autoRotate;
      globe.controls().autoRotateSpeed = 0.4;
    }
  }, [autoRotate]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (globe && globe.controls()) {
      globe.controls().autoRotate = autoRotate;
      globe.controls().autoRotateSpeed = 0.4;
    }
  }, [autoRotate]);

  return (
    <GlobeGl
      ref={globeRef}
      width={dimensions.width}
      height={dimensions.height}
      backgroundColor="#000000"
      globeImageUrl={textureUrl}
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      animateIn={true}
      waitForGlobeReady={true}
      onGlobeReady={handleGlobeReady}
      ambientLight={0.85}
      directionalLight={0.55}
      atmosphereColor="#00e5ff"
      atmosphereAltitude={0.22}
      enablePointerInteraction={true}
      onGlobeClick={onGlobeClick}
      objectsData={customData}
      objectLat={(d) => d.lat}
      objectLng={(d) => d.lng}
      objectAltitude={() => 0.01}
      objectThreeObject={customThreeObject}
      onObjectClick={onObjectClick}
      arcsData={arcsData}
      arcColor={arcColor}
      arcStroke={(arc) => arc.isGlow ? 0.15 : 0.04}
      arcAltitude={arcAltitude}
      arcsTransitionDuration={700}
      onArcClick={onArcClick}
    />
  );
}
