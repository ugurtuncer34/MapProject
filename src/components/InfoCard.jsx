export default function InfoCard({ points, onClose, onDelete, onAddVisit, onDrawRay }) {
  if (!points || points.length === 0) return null;

  const city = points[0].city;
  const country = points[0].country;
  const totalDays = points.reduce((s, p) => s + (p.weight || p.duration_days || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      <div className="pointer-events-auto m-6 mt-20 w-80 max-h-[70vh] overflow-y-auto bg-[#0a0f1a]/95 backdrop-blur-md border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(0,255,255,0.08)] p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-light tracking-[0.15em] text-cyan-300 uppercase">
              {city}
            </h2>
            <p className="text-cyan-500/40 text-xs font-mono tracking-wider mt-0.5">
              {country}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-cyan-500/30 hover:text-cyan-400/60 text-lg leading-none cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Total stats */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-cyan-500/10">
          <div className="text-center">
            <div className="text-cyan-300 text-lg font-mono">{points.length}</div>
            <div className="text-cyan-500/30 text-[10px] font-mono uppercase tracking-wider">Ziyaret</div>
          </div>
          <div className="text-center">
            <div className="text-cyan-300 text-lg font-mono">{totalDays}</div>
            <div className="text-cyan-500/30 text-[10px] font-mono uppercase tracking-wider">Toplam Gün</div>
          </div>
        </div>

        {/* Visit list */}
        <div className="space-y-2 mb-4">
          <h3 className="text-cyan-500/40 text-[10px] font-mono uppercase tracking-[0.2em] mb-2">
            Ziyaret Detayları
          </h3>
          {points.map((point, i) => {
            const days = point.weight || point.duration_days || 0;
            const date = point.visit_date || '—';
            const id = point.id;
            return (
              <div
                key={id || i}
                className="flex items-center justify-between bg-black/30 border border-cyan-500/10 rounded-lg px-3 py-2 group hover:border-cyan-500/25 transition-all"
              >
                <div>
                  <span className="text-cyan-200/80 text-xs font-mono">{date}</span>
                  <span className="text-cyan-500/30 text-xs ml-2">{days} gün</span>
                </div>
                <button
                  onClick={() => onDelete(id)}
                  className="text-red-400/30 hover:text-red-400 text-[10px] font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  Sil
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onAddVisit}
            className="w-full py-2.5 rounded-lg bg-cyan-500/8 border border-cyan-500/25 text-cyan-300/80 text-xs font-mono tracking-[0.15em] uppercase hover:bg-cyan-500/15 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(0,255,255,0.12)] transition-all cursor-pointer"
          >
            + Bu Şehre Yeni Ziyaret Ekle
          </button>
          <button
            onClick={() => onDrawRay(points[0])}
            className="w-full py-2.5 rounded-lg bg-purple-500/8 border border-purple-500/25 text-purple-300/80 text-xs font-mono tracking-[0.15em] uppercase hover:bg-purple-500/15 hover:border-purple-400/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.12)] transition-all cursor-pointer"
          >
            ⚡ Işın Çiz / Rota Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
