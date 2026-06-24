import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import GlobeGl from 'react-globe.gl';

const ARC_PALETTE = ['#ff6b6b', '#4fc3f7', '#ffd54f', '#69f0ae', '#ff80ab', '#c084fc'];

function durationColor(sumWeight) {
  const days = sumWeight || 0;
  const ratio = Math.min(Math.log10(Math.max(days, 1)) / 2.5, 1);
  const r = Math.round(ratio * 255);
  const g = Math.round(229 - ratio * 200);
  const b = Math.round(255 - ratio * 190);
  return `rgb(${r},${g},${b})`;
}

export default function Globe({
  textureUrl,
  locations,
  connections,
  arcColors,
  onGlobeClick,
  onHexBinClick,
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

  const hexBinPointWeight = useCallback(
    (d) => Number(d.duration_days || 0),
    []
  );

  const hexLabel = useCallback((d) => {
    const cities = [...new Set(d.points.map((p) => p.city).filter(Boolean))];
    const total = d.points.reduce((s, p) => s + Number(p.duration_days || 0), 0);
    return `${cities.join(', ')} (${total}g)`;
  }, []);

  const arcsData = useMemo(() => {
    if (!connections || connections.length === 0) return [];
    return connections.map((c) => ({
      startLat: c.start_lat,
      startLng: c.start_lng,
      endLat: c.end_lat,
      endLng: c.end_lng,
      id: c.id,
    }));
  }, [connections]);

  const arcColor = useCallback(
    (arc) => {
      if (arcColors && arcColors[arc.id]) return arcColors[arc.id];
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
    const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.min(0.06 + dist * 0.25, 0.32);
  }, []);

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
      hexBinPointsData={locations}
      hexBinPointLat={(d) => Number(d.latitude)}
      hexBinPointLng={(d) => Number(d.longitude)}
      hexBinPointWeight={hexBinPointWeight}
      hexAltitude={(d) => d.sumWeight * 0.005}
      hexBinResolution={4}
      hexMargin={0.1}
      hexTopColor={(d) => durationColor(d.sumWeight)}
      hexSideColor={(d) => durationColor(d.sumWeight)}
      hexBinMerge={false}
      hexLabel={hexLabel}
      onHexClick={onHexBinClick}
      arcsData={arcsData}
      arcColor={arcColor}
      arcStroke={0.2}
      arcAltitude={arcAltitude}
      arcsTransitionDuration={700}
      onArcClick={onArcClick}
    />
  );
}
