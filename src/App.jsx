import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Globe from './components/Globe';
import AddLocationModal from './components/AddLocationModal';
import InfoCard from './components/InfoCard';
import ControlPanel from './components/ControlPanel';
import MercatorMap from './components/MercatorMap';
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

  // ---- View mode state ----
  const [viewMode, setViewMode] = useState('globe');

  // ---- Ray drawing state ----
  const [rayMode, setRayMode] = useState(false);
  const [raySource, setRaySource] = useState(null);
  const [focusedCoords, setFocusedCoords] = useState(null);

  // ---- Arc color state ----
  const [arcColors, setArcColors] = useState({});
  const [arcPickerArc, setArcPickerArc] = useState(null);
  const [newArcDate, setNewArcDate] = useState('');

  // ---- Data hooks ----
  const { locations, fetchLocations, addLocation, deleteLocation } =
    useLocations();
  const { connections, fetchConnections, addConnection, deleteConnection } =
    useConnections();

  // ---- Timeline state ----
  const maxTime = useMemo(() => Date.now(), []);
  const [timelineVal, setTimelineVal] = useState(maxTime);

  const minTime = useMemo(() => {
    if (!locations || locations.length === 0) return new Date('1993-01-01').getTime();

    const validDates = locations
      .map(l => new Date(l.visit_date).getTime())
      .filter(t => !isNaN(t));

    if (validDates.length === 0) return new Date('1993-01-01').getTime();

    return Math.min(...validDates);
  }, [locations]);

  useEffect(() => { setTimelineVal(maxTime); }, [maxTime]);

  const activeStats = useMemo(() => {
    const active = locations.filter(l => new Date(l.visit_date).getTime() <= timelineVal);
    const countriesMap = {};

    active.forEach(l => {
      if (!countriesMap[l.country]) {
        countriesMap[l.country] = { totalDays: 0, lat: l.latitude, lng: l.longitude };
      }
      const elapsed = Math.floor((timelineVal - new Date(l.visit_date).getTime()) / (1000 * 60 * 60 * 24));
      countriesMap[l.country].totalDays += Math.min(elapsed, Number(l.duration_days || 0));
    });

    const countriesArray = Object.entries(countriesMap)
      .filter(([_, data]) => data.totalDays > 0)
      .sort((a, b) => b[1].totalDays - a[1].totalDays);

    return {
      countryCount: countriesArray.length,
      countries: countriesArray,
    };
  }, [locations, timelineVal]);

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
              Math.min(5 + Math.round((texReceived / texContentLength) * 30), 34)
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
              Math.min(38 + Math.round((geoReceived / geoContentLength) * 52), 95)
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

  // ---- InfoCard sync when locations update ----
  useEffect(() => {
    if (!infoCardOpen || infoCardPoints.length === 0) return;
    const city = infoCardPoints[0].city;
    const updated = locations.filter((loc) => loc.city === city);

    if (updated.length !== infoCardPoints.length) {
      setInfoCardPoints(updated);
    }
  }, [locations]);

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
          addConnection(raySource.id, targetPoint.id, targetPoint.visit_date);
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
      setArcColors((prev) => ({ ...prev, [arcPickerArc.originalId || arcPickerArc.originalId || arcPickerArc.id]: color }));
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
      {viewMode === 'globe' ? (
        <Globe
          textureUrl={textureUrl}
          timelineTimestamp={timelineVal}
          locations={locations}
          connections={connections}
          arcColors={arcColors}
          onGlobeClick={handleGlobeClick}
          onObjectClick={handleHexBinClick}
          onArcClick={handleArcClick}
          focusedCoords={focusedCoords}
          autoRotate={effectiveAutoRotate}
        />
      ) : (
        <MercatorMap
          timelineTimestamp={timelineVal}
          locations={locations}
          connections={connections}
          arcColors={arcColors}
          onGlobeClick={handleGlobeClick}
          onObjectClick={handleHexBinClick}
          onArcClick={handleArcClick}
          focusedCoords={focusedCoords}
          autoRotate={effectiveAutoRotate}
        />
      )}

      <ControlPanel
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode((p) => (p === 'globe' ? 'mercator' : 'globe'))}
        autoRotate={autoRotate}
        onToggle={() => setAutoRotate((p) => !p)}
        rayMode={rayMode}
        onCancelRay={handleCancelRay}
      />

      {/* Stats Panel */}
      <div className="fixed top-6 right-6 z-40 bg-black/40 backdrop-blur-md border border-cyan-500/20 rounded-xl p-4 w-64 max-h-[60vh] overflow-y-auto shadow-[0_0_30px_rgba(0,255,255,0.06)]">
        <div className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-wider mb-3 flex justify-between">
          <span>Ziyaret Edilen Ülkeler</span>
          <span className="text-cyan-300 font-bold">{activeStats.countryCount}</span>
        </div>
        <div className="space-y-2">
          {activeStats.countries.map(([countryName, data]) => (
            <div
              key={countryName}
              onClick={() => setFocusedCoords({ lat: data.lat, lng: data.lng })}
              className="flex justify-between items-center group cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded transition-colors"
            >
              <span className="text-cyan-100 text-xs font-mono group-hover:text-cyan-300">{countryName}</span>
              <span className="text-cyan-500/60 text-[10px] font-mono">{data.totalDays} gün</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 backdrop-blur-md bg-black/40 border border-cyan-500/20 rounded-xl px-5 py-3 flex items-center gap-4 shadow-[0_0_30px_rgba(0,255,255,0.06)] w-[80vw] max-w-4xl">
        <span className="text-cyan-300/80 text-xs font-mono whitespace-nowrap min-w-[120px] text-right">
          {new Date(timelineVal).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
        </span>
        <input
          type="range"
          min={minTime}
          max={maxTime}
          value={timelineVal}
          onChange={(e) => setTimelineVal(Number(e.target.value))}
          className="w-full h-1 bg-cyan-900/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,255,0.4)]"
        />
        <span className="text-cyan-500/40 text-xs font-mono whitespace-nowrap min-w-[120px]">
          {new Date(maxTime).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
        </span>
      </div>

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

      {/* Arc Detail Card */}
      {arcPickerArc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setArcPickerArc(null); setNewArcDate(''); }}
        >
          <div
            className="bg-[#0a0f1a] border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(0,255,255,0.08)] p-6 w-80 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-cyan-300 text-sm font-mono tracking-[0.15em] uppercase">Rota Detayları</h3>
              <button onClick={() => setArcPickerArc(null)} className="text-cyan-500/50 hover:text-cyan-300 transition-colors cursor-pointer">✕</button>
            </div>

            <div className="mb-6">
              <h4 className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-wider mb-2">Ziyaret Tarihleri</h4>
              <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto pr-2">
                {(arcPickerArc.dates && arcPickerArc.dates.length > 0) ? arcPickerArc.dates.map((date, i) => (
                  <div key={i} className="flex items-center justify-between text-cyan-100 text-xs font-mono bg-black/40 px-3 py-2 rounded-lg border border-cyan-500/10 group">
                    <span>{date}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          const newDate = prompt("Tarihi düzenle (YYYY-MM-DD):", date);
                          if (newDate && newDate !== date) {
                            const newDates = [...arcPickerArc.dates];
                            newDates[i] = newDate;
                            const res = await fetch(`/api/connections/${arcPickerArc.originalId || arcPickerArc.id}/dates`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ dates: newDates })
                            });
                            if(res.ok) { setArcPickerArc(p => ({...p, dates: newDates})); fetchConnections(); }
                          }
                        }}
                        className="text-cyan-500/50 hover:text-cyan-300 cursor-pointer"
                      >✎</button>
                      <button
                        onClick={async () => {
                          if(!window.confirm("Silmek istediğinize emin misiniz?")) return;
                          const newDates = arcPickerArc.dates.filter((_, index) => index !== i);
                          const res = await fetch(`/api/connections/${arcPickerArc.originalId || arcPickerArc.id}/dates`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dates: newDates })
                          });
                          if(res.ok) { setArcPickerArc(p => ({...p, dates: newDates})); fetchConnections(); }
                        }}
                        className="text-red-500/50 hover:text-red-400 cursor-pointer"
                      >✕</button>
                    </div>
                  </div>
                )) : (
                  <div className="text-cyan-500/30 text-xs font-mono italic">Henüz tarih eklenmemiş.</div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newArcDate}
                  onChange={(e) => setNewArcDate(e.target.value)}
                  className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-2 py-2 text-cyan-100 text-xs focus:outline-none focus:border-cyan-400/50 [color-scheme:dark]"
                />
                <button
                  onClick={async () => {
                    if(!newArcDate) return;
                    const res = await fetch(`/api/connections/${arcPickerArc.originalId || arcPickerArc.id}/dates`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ date: newArcDate }),
                    });
                    if (res.ok) {
                      setArcPickerArc(prev => ({...prev, dates: [...(prev.dates || []), newArcDate]}));
                      setNewArcDate('');
                      fetchConnections();
                    }
                  }}
                  className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 px-3 py-2 rounded-lg text-xs font-mono hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all cursor-pointer"
                >
                  Ekle
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-wider mb-2">Işın Rengi</h4>
              <div className="flex flex-wrap gap-2 justify-center">
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
        </div>
      )}
    </>
  );
}
