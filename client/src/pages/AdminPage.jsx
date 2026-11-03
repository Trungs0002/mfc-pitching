import React, { useCallback, useEffect, useState } from 'react';
import { api, explain } from '../apiConfig';

const STATUS = {
  not_entered: 'Chưa vào',
  in_session: 'Đang trong phiên',
  chosen: 'Đã chọn',
  lost: 'Mất lượt',
  waiting: 'Chờ random',
};

const TOKEN_KEY = 'mfc_pitching_admin';
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

const AdminPage = () => {
  const [token, setToken] = useState(readToken);
  const [pw, setPw] = useState('');
  const [data, setData] = useState(null);
  const [names, setNames] = useState('TT01\nTT02\nTT03\nMC01\nMC02\nMC03');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    setToken('');
    setData(null);
  }, []);

  const load = useCallback(() => {
    if (!token) return;
    api('/api/admin/teams', { token })
      .then(setData)
      .catch((e) => { if (e.status === 401) logout(); else setError(explain(e)); });
  }, [token, logout]);

  useEffect(() => {
    load();
    if (!token) return undefined;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load, token]);

  const run = async (path, opts, after) => {
    setBusy(true);
    setError('');
    try {
      const d = await api(path, { token, ...opts });
      setData(d);
      if (after) after(d);
    } catch (e) {
      if (e.status === 401) logout(); else setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/api/admin/login', { method: 'POST', body: { password: pw } });
      try { sessionStorage.setItem(TOKEN_KEY, d.token); } catch {}
      setToken(d.token);
      setPw('');
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = (id, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(''), 1200);
    }).catch(() => {});
  };

  const finalize = () => {
    if (!window.confirm('Chốt và random ngay? Các team chưa chọn sẽ mất lượt.')) return;
    run('/api/admin/finalize', { method: 'POST' });
  };

  if (!token) {
    return (
      <div className="page-wrap">
        <form className="mfc-card panel-narrow" onSubmit={login}>
          <input
            className="mfc-input"
            type="password"
            placeholder="Mật khẩu admin"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button className="btn-pill btn-pill-sm" type="submit" disabled={busy || !pw}>Đăng nhập</button>
          </div>
        </form>
      </div>
    );
  }

  const teams = data?.teams || [];

  return (
    <div className="page-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="serif gradient-title-hero" style={{ fontSize: 38, fontWeight: 700 }}>Admin</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-pill btn-pill-sm" disabled={busy || !data || data.randomDone} onClick={finalize}>
            Chốt và random
          </button>
          <button className="btn-outline-pill btn-pill-sm" onClick={logout}>Đăng xuất</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {data && !data.randomDone && (
        <div className="mfc-card" style={{ padding: 20, marginTop: 20 }}>
          <textarea
            className="mfc-input"
            rows={4}
            placeholder={'Tên team, mỗi dòng một team'}
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <button
              className="btn-pill btn-pill-sm"
              disabled={busy || !names.trim()}
              onClick={() => run('/api/admin/teams', { method: 'POST', body: { names: names.split('\n') } }, (d) => {
                setNames('');
                if (d.skipped?.length) setError(`Trùng tên, bỏ qua: ${d.skipped.join(', ')}`);
              })}
            >
              Tạo mật khẩu
            </button>
          </div>
        </div>
      )}

      <div className="mfc-card" style={{ padding: 8, marginTop: 20 }}>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Mật khẩu</th>
                <th>Trạng thái</th>
                <th>Số</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>
                    <span className="pw">{t.password}</span>{' '}
                    <button className="badge" style={{ cursor: 'pointer' }} onClick={() => copy(t._id, t.password)}>
                      {copied === t._id ? 'Đã chép' : 'Chép'}
                    </button>
                    {t.used && <span className="badge" style={{ marginLeft: 6 }}>Đã dùng</span>}
                  </td>
                  <td><span className="badge">{STATUS[t.status]}</span></td>
                  <td>{t.slot ?? ''}{t.slot != null && t.slotSource === 'random' ? ' (random)' : ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {t.status === 'not_entered' && !data.randomDone && (
                      <>
                        <button
                          className="badge"
                          style={{ cursor: 'pointer', marginRight: 6 }}
                          disabled={busy}
                          onClick={() => run(`/api/admin/teams/${t._id}/regenerate`, { method: 'POST' })}
                        >
                          Đổi mật khẩu
                        </button>
                        <button
                          className="badge"
                          style={{ cursor: 'pointer', color: '#ff6b6b' }}
                          disabled={busy}
                          onClick={() => window.confirm(`Xóa ${t.name}?`) && run(`/api/admin/teams/${t._id}`, { method: 'DELETE' })}
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
