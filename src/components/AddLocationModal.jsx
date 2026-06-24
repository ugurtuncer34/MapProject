import { useState } from 'react';

export default function AddLocationModal({ lat, lng, onSubmit, onClose, prefill }) {
  const [city, setCity] = useState(prefill?.city || '');
  const [country, setCountry] = useState(prefill?.country || '');
  const [latInput, setLatInput] = useState(String(prefill?.latitude ?? lat));
  const [lngInput, setLngInput] = useState(String(prefill?.longitude ?? lng));
  const [visitDate, setVisitDate] = useState('');
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!city.trim() || !country.trim() || !visitDate || !duration) return;

    setSubmitting(true);
    await onSubmit({
      city: city.trim(),
      country: country.trim(),
      latitude: parseFloat(latInput),
      longitude: parseFloat(lngInput),
      visit_date: visitDate,
      duration_days: parseInt(duration, 10),
    });
    setSubmitting(false);
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-md mx-4 bg-[#0a0f1a] border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(0,255,255,0.08)] p-7">
        <h2 className="text-lg font-light tracking-[0.2em] text-cyan-300 uppercase mb-6">
          Yeni Lokasyon
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Şehir</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required autoFocus
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm placeholder-cyan-500/20 focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all" placeholder="İstanbul" />
            </div>
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Ülke</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm placeholder-cyan-500/20 focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all" placeholder="Türkiye" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Enlem</label>
              <input type="number" step="any" value={latInput} onChange={(e) => setLatInput(e.target.value)} required
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all" />
            </div>
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Boylam</label>
              <input type="number" step="any" value={lngInput} onChange={(e) => setLngInput(e.target.value)} required
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Tarih</label>
              <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-cyan-500/50 text-xs font-mono tracking-wider mb-1.5 uppercase">Gün</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required min="1"
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-100 text-sm placeholder-cyan-500/20 focus:outline-none focus:border-cyan-400/50 focus:shadow-[0_0_10px_rgba(0,255,255,0.1)] transition-all" placeholder="3" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-cyan-500/15 text-cyan-500/40 text-sm font-mono tracking-wider uppercase hover:border-cyan-500/30 hover:text-cyan-400/60 transition-all cursor-pointer">İptal</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-sm font-mono tracking-wider uppercase hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all disabled:opacity-40 cursor-pointer">
              {submitting ? 'Kaydediliyor...' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
