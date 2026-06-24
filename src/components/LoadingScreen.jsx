export default function LoadingScreen({ progress, message }) {
  return (
    <div className="fixed inset-0 bg-[#06060f] flex flex-col items-center justify-center z-50 select-none">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="absolute top-8 left-8 w-20 h-20 border-l border-t border-cyan-500/20" />
      <div className="absolute top-8 right-8 w-20 h-20 border-r border-t border-cyan-500/20" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-l border-b border-cyan-500/20" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-r border-b border-cyan-500/20" />

      <div className="relative mb-14">
        <div className="w-28 h-28 rounded-full border-2 border-cyan-500/10" />
        <div
          className="absolute inset-0 w-28 h-28 rounded-full border-t-2 border-cyan-400 animate-spin"
          style={{ boxShadow: '0 0 25px rgba(0,255,255,0.25)' }}
        />
        <div className="absolute inset-3 w-[88px] h-[88px] rounded-full border border-cyan-500/30" />
        <div className="absolute inset-6 w-16 h-16 rounded-full border border-cyan-500/15" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-cyan-300 text-lg font-mono font-bold tracking-wider">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <h1 className="text-4xl font-extralight tracking-[0.35em] text-cyan-300/80 mb-5 uppercase">
        Geo-Life Map
      </h1>

      <div className="w-80 h-[2px] bg-cyan-900/20 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-blue-400 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 18px rgba(0,255,255,0.45)',
          }}
        />
      </div>

      <p className="text-cyan-400/50 text-sm font-mono tracking-[0.15em] uppercase">
        {message}
      </p>
    </div>
  );
}
