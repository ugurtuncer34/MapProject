import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Globe from './components/Globe';
import AddLocationModal from './components/AddLocationModal';
import InfoCard from './components/InfoCard';
import ControlPanel from './components/ControlPanel';
import useLocations, { useConnections } from './hooks/useLocations';

const TEXTURE_URL =
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';

const ARC_PALETTE = [
  '#ff6b6b', '#4fc3f7', '#ffd54f', '#69f0ae', '#ff80ab', '#c084fc',
  '#ffffff', '#ff9100',
];

export default function App() {
  // ---- Loading state ----
  const [phase, setPhase] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Başlatılıyor...');
  const [textureUrl, setTextureUrl] = useState(null);
  const cancelled = useRef(false);

  // ---- UI state ----
  const [autoRotate, setAutoRotate] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCoords, setModalCoords] = useState({ lat: 0, lng: 0 });
  const [modalPrefill, setModalPrefill] = useState(null);

  // ---- InfoCard state ----
  const [infoCardOpen, setInfoCardOpen] = useState(false);
  const [infoCardPoints, setInfoCardPoints] = useState([]);

  // ---- Ray drawing state ----
  const [rayMode, setRayMode] = useState(false);
  const [raySource, setRaySource] = useState(null);

  // ---- Arc color state ----
  const [arcColors, setArcColors] = useState({});
  const [arcPickerArc, setArcPickerArc] = useState(null);

  // ---- Data hooks ----
  const { locations, fetchLocations, addLocation, deleteLocation } =
    useLocations();
  const { connections, fetchConnections, addConnection, deleteConnection } =
    useConnections();

  // ---- Async asset loading ----
  useEffect(() => {
    cancelled.current = false;

    async function loadAll() {
      try {
        setMessage('Harita kaplaması indiriliyor...');
        setProgress(5);

        const texRes = await fetch(TEXTURE_URL);
        if (!texRes.ok) throw new Error('Kaplama indirilemedi');

        const texContentLength = +texRes.headers.get('Content-Length') || 0;
        const texReader = texRes.body.getReader();
        const texChunks = [];
        let texReceived = 0;

        while (true) {
          const { done, value } = await texReader.read();
          if (done) break;
          texChunks.push(value);
          texReceived += value.length;
          if (texContentLength && !cancelled.current)
            setProgress(
              5 + Math.round((texReceived / texContentLength) * 30)
            );
        }
        if (cancelled.current) return;

        const texBlob = new Blob(texChunks);
        setTextureUrl(URL.createObjectURL(texBlob));
        setProgress(35);

        setMessage('Ülke sınırları yükleniyor...');
        setProgress(38);

        const geoRes = await fetch(GEOJSON_URL);
        if (!geoRes.ok) throw new Error('GeoJSON indirilemedi');

        const geoContentLength = +geoRes.headers.get('Content-Length') || 0;
        const geoReader = geoRes.body.getReader();
        const geoChunks = [];
        let geoReceived = 0;

        while (true) {
          const { done, value } = await geoReader.read();
          if (done) break;
          geoChunks.push(value);
          geoReceived += value.length;
          if (geoContentLength && !cancelled.current)
            setProgress(
              38 + Math.round((geoReceived / geoContentLength) * 52)
            );
        }
        if (cancelled.current) return;

        const decoder = new TextDecoder();
        const geoText =
          geoChunks
            .map((c) => decoder.decode(c, { stream: true }))
            .join('') + decoder.decode();
        JSON.parse(geoText);

        setMessage('Harita hazırlanıyor...');
        setProgress(98);
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled.current) return;

        setProgress(100);
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled.current) return;

        setPhase('ready');
      } catch (err) {
        if (!cancelled.current) {
          setMessage(`Hata: ${err.message}`);
          console.error(err);
        }
      }
    }

    loadAll();
    return () => {
      cancelled.current = true;
    };
  }, []);

  // ---- Fetch DB data on ready ----
  useEffect(() => {
    if (phase === 'ready') {
      fetchLocations();
      fetchConnections();
    }
  }, [phase, fetchLocations, fetchConnections]);

  // ---- Auto-rotate: stop when UI is open ----
  const effectiveAutoRotate = autoRotate && !infoCardOpen && !rayMode && !arcPickerArc;

  // ---- Globe click → add location ----
  const handleGlobeClick = useCallback(
    (coords) => {
      if (infoCardOpen || rayMode) return;
      setModalCoords({ lat: coords.lat, lng: coords.lng });
      setModalPrefill(null);
      setModalOpen(true);
    },
    [infoCardOpen, rayMode]
  );

  // ---- HexBin click → InfoCard or complete ray ----
  const handleHexBinClick = useCallback(
    (hex) => {
      if (!hex || !hex.points || hex.points.length === 0) return;

      if (rayMode) {
        const targetPoint = hex.points[0];
        if (raySource && targetPoint.id !== raySource.id) {
          addConnection(raySource.id, targetPoint.id);
        }
        setRayMode(false);
        setRaySource(null);
        return;
      }

      setInfoCardPoints(hex.points);
      setInfoCardOpen(true);
    },
    [rayMode, raySource, addConnection]
  );

  // ---- Arc click → color picker ----
  const handleArcClick = useCallback((arc) => {
    if (!arc || !arc.id) return;
    setArcPickerArc(arc);
  }, []);

  const handleArcColorSelect = useCallback(
    (color) => {
      if (!arcPickerArc) return;
      setArcColors((prev) => ({ ...prev, [arcPickerArc.id]: color }));
      setArcPickerArc(null);
    },
    [arcPickerArc]
  );

  // ---- Modal actions ----
  const handleModalSubmit = useCallback(
    async (location) => {
      const finalLocation = { ...location };
      if (modalPrefill) {
        finalLocation.city = modalPrefill.city || location.city;
        finalLocation.country = modalPrefill.country || location.country;
        finalLocation.latitude = modalPrefill.latitude ?? location.latitude;
        finalLocation.longitude = modalPrefill.longitude ?? location.longitude;
      }
      await addLocation(finalLocation);
      setModalOpen(false);
      setModalPrefill(null);
    },
    [addLocation, modalPrefill]
  );

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setModalPrefill(null);
  }, []);

  // ---- InfoCard actions ----
  const handleDeleteVisit = useCallback(
    async (id) => {
      if (!id) return;
      await deleteLocation(id);
      setInfoCardOpen(false);
      setInfoCardPoints([]);
    },
    [deleteLocation]
  );

  const handleAddVisit = useCallback(() => {
    if (infoCardPoints.length === 0) return;
    const first = infoCardPoints[0];
    setModalPrefill({
      city: first.city,
      country: first.country,
      latitude: first.latitude,
      longitude: first.longitude,
    });
    setModalCoords({ lat: first.latitude, lng: first.longitude });
    setInfoCardOpen(false);
    setModalOpen(true);
  }, [infoCardPoints]);

  const handleDrawRay = useCallback((point) => {
    if (!point) return;
    setRaySource({
      id: point.id,
      city: point.city,
      country: point.country,
      lat: point.latitude,
      lng: point.longitude,
    });
    setInfoCardOpen(false);
    setRayMode(true);
  }, []);

  const handleCancelRay = useCallback(() => {
    setRayMode(false);
    setRaySource(null);
  }, []);

  // ---- Render ----
  if (phase === 'loading') {
    return <LoadingScreen progress={progress} message={message} />;
  }

  return (
    <>
      <Globe
        textureUrl={textureUrl}
        locations={locations}
        connections={connections}
        arcColors={arcColors}
        onGlobeClick={handleGlobeClick}
        onHexBinClick={handleHexBinClick}
        onArcClick={handleArcClick}
        autoRotate={effectiveAutoRotate}
      />

      <ControlPanel
        autoRotate={autoRotate}
        onToggle={() => setAutoRotate((p) => !p)}
        rayMode={rayMode}
        onCancelRay={handleCancelRay}
      />

      {modalOpen && (
        <AddLocationModal
          lat={modalPrefill?.latitude ?? modalCoords.lat}
          lng={modalPrefill?.longitude ?? modalCoords.lng}
          onSubmit={handleModalSubmit}
          onClose={handleModalClose}
          prefill={modalPrefill}
        />
      )}

      {infoCardOpen && (
        <InfoCard
          points={infoCardPoints}
          onClose={() => {
            setInfoCardOpen(false);
            setInfoCardPoints([]);
          }}
          onDelete={handleDeleteVisit}
          onAddVisit={handleAddVisit}
          onDrawRay={handleDrawRay}
        />
      )}

      {/* Arc Color Picker */}
      {arcPickerArc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setArcPickerArc(null)}
        >
          <div
            className="bg-[#0a0f1a] border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(0,255,255,0.08)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-cyan-300 text-sm font-mono tracking-[0.15em] uppercase mb-3">
              Işın Rengi
            </h3>
            <div className="flex flex-wrap gap-2 w-48 justify-center">
              {ARC_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => handleArcColorSelect(color)}
                  className="w-8 h-8 rounded-full border-2 border-transparent hover:border-white/60 hover:scale-110 transition-all cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
