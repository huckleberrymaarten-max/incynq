import { useState } from 'react';
import C from '../theme';
import { SL_CHARS } from '../data';

const TAB_LABELS = {
  Popular: '⭐ Popular', Borders: '꧁ Borders', 'Name deco': '★ Name deco',
  Symbols: '♠ Symbols', Japanese: '〜 Japanese', Misc: '· Misc', Emoji: '😊 Emoji',
};

export default function SLCharPicker({ onInsert, onClose }) {
  const [tab, setTab] = useState('Popular');
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 30px #00000066',
    }}>
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.border}`, background: C.card2 }}>
        {Object.keys(SL_CHARS).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 700,
            color: tab === t ? C.sky : C.muted,
            borderBottom: `2px solid ${tab === t ? C.sky : 'transparent'}`,
            whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s',
          }}>
            {TAB_LABELS[t] || t}
          </button>
        ))}
        <button onClick={onClose} style={{ marginLeft: 'auto', padding: '8px 14px', color: C.muted, fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
        {SL_CHARS[tab].map((c, i) => (
          <button key={i} onClick={() => onInsert(c)} style={{
            width: 36, height: 36, borderRadius: 8,
            background: C.card2, border: `1px solid ${C.border}`,
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.sky}22`}
            onMouseLeave={e => e.currentTarget.style.background = C.card2}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
