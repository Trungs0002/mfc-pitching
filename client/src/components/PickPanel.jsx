import React, { useEffect, useRef, useState } from 'react';
import { api } from '../apiConfig';

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Dong ho chi de hien thi, server moi la noi quyet dinh het gio
const PickPanel = ({ session, onPicked, onExpired, onUpdate, board }) => {
  const [free, setFree] = useState(session.free);
  const [selected, setSelected] = useState(null);
  const [current, setCurrent] = useState(null);
  const currentRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offset] = useState(() => new Date(session.now).getTime() - Date.now());
  const end = new Date(session.sessionEnd).getTime();
  const [remaining, setRemaining] = useState(end - (Date.now() + offset));

  // Dong bo cac so con trong theo bang moi nhat
  useEffect(() => {
    if (board && Array.isArray(board.slots)) {
      setFree(board.slots.filter((s) => !s.team).map((s) => s.slot));
    }
  }, [board]);

  // Het gio: neu da co so thi chot so do, chua co thi mat luot
  const finish = () => {
    if (currentRef.current != null) onPicked({ team: session.team.name, slot: currentRef.current });
    else onExpired();
  };

  useEffect(() => {
    const id = setInterval(() => {
      const r = end - (Date.now() + offset);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        finish();
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, offset]);

  useEffect(() => {
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const confirm = async () => {
    if (!selected || busy || selected === current) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/pick', { method: 'POST', token: session.token, body: { slot: selected } });
      const prev = currentRef.current;
      setFree((f) => [...f.filter((n) => n !== data.slot), ...(prev != null ? [prev] : [])].sort((x, y) => x - y));
      currentRef.current = data.slot;
      setCurrent(data.slot);
      if (onUpdate) onUpdate();
      setBusy(false);
    } catch (e) {
      if (e.status === 409 && e.data?.free) {
        setFree(e.data.free);
        setSelected(currentRef.current);
      }
      if (e.status === 401 || e.status === 403) {
        finish();
        return;
      }
      setError(e.message);
      setBusy(false);
    }
  };

  const freeSet = new Set(free);
  if (current != null) freeSet.add(current);

  return (
    <div className="mfc-card" style={{ maxWidth: 760, margin: '28px auto 0', padding: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="serif" style={{ fontSize: 30, fontWeight: 700 }}>{session.team.name}</div>
        <div className={`timer ${remaining < 60000 ? 'low' : ''}`}>{fmt(remaining)}</div>
      </div>

      <div className="pick-grid" style={{ marginTop: 22 }}>
        {Array.from({ length: session.total }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`pick-btn ${selected === n ? 'selected' : ''}`}
            disabled={!freeSet.has(n) || busy}
            onClick={() => setSelected(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button className="btn-pill" disabled={!selected || busy || selected === current} onClick={confirm}>
          {selected === current && current != null ? `Đã chọn số ${current}` : selected ? `Xác nhận số ${selected}` : 'Chọn một số'}
        </button>
      </div>
    </div>
  );
};

export default PickPanel;
