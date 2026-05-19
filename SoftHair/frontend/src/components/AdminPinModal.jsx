import { useState, useEffect, useRef } from 'react';
import { useAdminPin } from '../context/AdminPinContext';
import { Lock, X, Delete } from 'lucide-react';

export default function AdminPinModal() {
  const { pending, handleSubmit, handleCancel } = useAdminPin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (pending) {
      setPin('');
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pending]);

  if (!pending) return null;

  function addDigit(d) {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 6) {
      setTimeout(() => submit(next), 80);
    }
  }

  function delDigit() {
    setPin(p => p.slice(0, -1));
    setError(false);
  }

  function submit(p = pin) {
    const ok = handleSubmit(p);
    if (!ok) {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  }

  function onKey(e) {
    if (e.key >= '0' && e.key <= '9') addDigit(e.key);
    else if (e.key === 'Backspace') delDigit();
    else if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') handleCancel();
  }

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  const numpad = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    [null,'0','del'],
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}>
      <div
        className={`relative flex flex-col items-center gap-6 px-10 py-10 rounded-3xl shadow-2xl ${shake ? 'animate-shake' : ''}`}
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(40px)',
          minWidth: 320,
        }}
        onKeyDown={onKey}
        tabIndex={-1}
        ref={inputRef}
      >
        {/* Close */}
        <button onClick={handleCancel}
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors">
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Lock size={24} className="text-white" />
          </div>
          <p className="text-white font-semibold text-lg tracking-tight">Área restrita</p>
          <p className="text-white/50 text-sm">Digite o PIN de administrador</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {dots.map((filled, i) => (
            <div key={i}
              className="w-4 h-4 rounded-full transition-all duration-150"
              style={{
                background: error
                  ? 'rgba(255,80,80,0.9)'
                  : filled
                    ? 'rgba(255,255,255,0.95)'
                    : 'rgba(255,255,255,0.2)',
                transform: filled ? 'scale(1.1)' : 'scale(1)',
              }} />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm -mt-2">PIN incorreto</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {numpad.flat().map((key, i) => {
            if (key === null) return <div key={i} />;
            if (key === 'del') return (
              <button key={i}
                onClick={delDigit}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Delete size={20} />
              </button>
            );
            return (
              <button key={i}
                onClick={() => addDigit(key)}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-medium transition-all active:scale-95 hover:brightness-125"
                style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {key}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake { animation: shake 0.45s ease-in-out; }
      `}</style>
    </div>
  );
}
