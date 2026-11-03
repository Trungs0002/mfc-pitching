import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../apiConfig';
import Board from '../components/Board';
import PickPanel from '../components/PickPanel';

const HomePage = () => {
  const [board, setBoard] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('enter'); // enter | pick | done | expired
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);

  const loadBoard = useCallback(() => {
    api('/api/board').then(setBoard).catch(() => {});
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/enter', { method: 'POST', body: { password } });
      setSession(data);
      setPassword('');
      setPhase('pick');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onPicked = (r) => {
    setResult(r);
    setSession(null);
    setPhase('done');
    loadBoard();
  };

  const onExpired = useCallback(() => {
    setSession(null);
    setPhase('expired');
    loadBoard();
  }, [loadBoard]);

  return (
    <div className="page-wrap">
      <div className="hero">
        <h1 className="gradient-title-hero">MFC</h1>
        <p>Chọn thứ tự pitching</p>
      </div>

      {phase === 'enter' && (
        <form className="mfc-card panel-narrow" onSubmit={submit}>
          <input
            className="mfc-input"
            type="password"
            autoComplete="off"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button className="btn-pill btn-pill-sm" type="submit" disabled={busy || !password.trim()}>
              {busy ? 'Đang kiểm tra...' : 'Vào'}
            </button>
          </div>
        </form>
      )}

      {phase === 'pick' && session && (
        <PickPanel session={session} onPicked={onPicked} onExpired={onExpired} />
      )}

      {phase === 'done' && result && (
        <div className="mfc-card panel-narrow" style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 28, fontWeight: 700 }}>{result.team}</div>
          <div className="gradient-title-hero" style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1 }}>
            {result.slot}
          </div>
        </div>
      )}

      {phase === 'expired' && (
        <div className="mfc-card panel-narrow" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0 }}>Hết thời gian, team đã mất lượt.</p>
        </div>
      )}

      <Board board={board} />
    </div>
  );
};

export default HomePage;
