export default function ControlPanel({ autoRotate, onToggle, rayMode, onCancelRay }) {
  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2">
      {rayMode && (
        <div className="backdrop-blur-md bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3 shadow-[0_0_25px_rgba(168,85,247,0.12)] animate-pulse">
          <p className="text-purple-300/90 text-xs font-mono tracking-[0.1em] uppercase mb-2">
            Hedef Seçme Modu
          </p>
          <p className="text-purple-400/50 text-[10px] font-mono mb-2">
            Haritada bir sütuna tıklayarak hedefi seçin
          </p>
          <button
            onClick={onCancelRay}
            className="text-purple-400/60 hover:text-purple-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-colors"
          >
            İptal
          </button>
        </div>
      )}

      <button
        onClick={onToggle}
        className="backdrop-blur-md bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-cyan-300/80 text-xs font-mono tracking-[0.12em] uppercase hover:bg-cyan-500/10 hover:border-cyan-400/30 hover:shadow-[0_0_20px_rgba(0,255,255,0.12)] transition-all cursor-pointer"
      >
        {autoRotate ? '◉ Dönüş Açık' : '○ Dönüş Kapalı'}
      </button>
    </div>
  );
}
