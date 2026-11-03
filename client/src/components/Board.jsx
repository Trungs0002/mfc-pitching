import React from 'react';

const Board = ({ board }) => {
  if (!board || board.total === 0) return null;
  return (
    <section style={{ marginTop: 56 }}>
      <div className="section-eyebrow">
        <span className="gradient-title-hero">Thứ tự pitching</span>
      </div>

      <div className="slot-grid" style={{ marginTop: 22 }}>
        {board.slots.map((s) => (
          <div key={s.slot} className={`slot-card ${s.team ? 'taken' : 'free'}`}>
            <div className="slot-num">{s.slot}</div>
            <div style={{ minWidth: 0 }}>
              <div className="slot-team">{s.team || 'Còn trống'}</div>
            </div>
          </div>
        ))}
        {board.waiting.map((name) => (
          <div key={name} className="slot-card" style={{ borderStyle: 'dashed' }}>
            <div className="slot-num" style={{ color: 'var(--muted)' }}>?</div>
            <div style={{ minWidth: 0 }}>
              <div className="slot-team">{name}</div>
              <div className="slot-sub">Chờ random</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Board;
