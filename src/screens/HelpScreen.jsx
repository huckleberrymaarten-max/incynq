import { useState } from 'react';
import C from '../theme';
import { QA_DATA } from '../data/qaData';

export default function HelpScreen({ onClose }) {
  const [openItem, setOpenItem] = useState(null);
  const [search, setSearch] = useState('');
  const [activePart, setActivePart] = useState(0);

  const toggle = key => setOpenItem(openItem === key ? null : key);

  // Filter by search
  const filtered = search.trim()
    ? QA_DATA.map(part => ({
        ...part,
        sections: part.sections.map(sec => ({
          ...sec,
          items: sec.items.filter(
            item =>
              item.q.toLowerCase().includes(search.toLowerCase()) ||
              item.a.toLowerCase().includes(search.toLowerCase())
          ),
        })).filter(sec => sec.items.length > 0),
      })).filter(part => part.sections.length > 0)
    : QA_DATA;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.bg, zIndex: 800,
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
        background: C.card, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300 }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Help & FAQ</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Everything you need to know</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.muted }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="inp"
            style={{ paddingLeft: 36 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Part tabs — only shown when not searching */}
      {!search && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
          {QA_DATA.map((part, i) => (
            <button
              key={i}
              onClick={() => setActivePart(i)}
              style={{
                flex: 1, padding: '11px 8px', fontSize: 12, fontWeight: 700,
                color: activePart === i ? C.sky : C.muted,
                borderBottom: `2px solid ${activePart === i ? C.sky : 'transparent'}`,
                transition: 'all .2s', lineHeight: 1.3,
              }}
            >
              {i === 0 ? '👤 Members' : '🏢 Brands'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No results</div>
            <div style={{ fontSize: 13 }}>Try a different search term.</div>
          </div>
        )}

        {(search ? filtered : [filtered[activePart]].filter(Boolean)).map((part, pi) => (
          <div key={pi}>
            {search && (
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 12, marginTop: pi > 0 ? 20 : 0 }}>
                {part.part.toUpperCase()}
              </div>
            )}
            {part.sections.map((sec, si) => (
              <div key={si} style={{ marginBottom: 20 }}>
                {/* Section title */}
                <div style={{
                  fontSize: 13, fontWeight: 800, color: C.sky,
                  marginBottom: 8, paddingBottom: 6,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {sec.title}
                </div>

                {/* Q&A items */}
                {sec.items.map((item, ii) => {
                  const key = `${pi}-${si}-${ii}`;
                  const isOpen = openItem === key;
                  return (
                    <div key={ii} style={{
                      marginBottom: 6, borderRadius: 12, overflow: 'hidden',
                      border: `1px solid ${isOpen ? C.sky + '44' : C.border}`,
                      transition: 'border-color .2s',
                    }}>
                      {/* Question */}
                      <button
                        onClick={() => toggle(key)}
                        style={{
                          width: '100%', padding: '12px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 10, background: isOpen ? `${C.sky}08` : C.card2,
                          textAlign: 'left', transition: 'background .2s',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, lineHeight: 1.4 }}>
                          {item.q}
                        </span>
                        <span style={{
                          fontSize: 16, color: isOpen ? C.sky : C.muted,
                          transform: isOpen ? 'rotate(45deg)' : 'none',
                          transition: 'transform .2s, color .2s', flexShrink: 0,
                        }}>
                          +
                        </span>
                      </button>

                      {/* Answer */}
                      {isOpen && (
                        <div style={{
                          padding: '10px 14px 14px',
                          background: `${C.sky}05`,
                          borderTop: `1px solid ${C.sky}22`,
                        }}>
                          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
                            {item.a}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: 20, padding: '12px 14px',
          background: `${C.sky}0a`, border: `1px solid ${C.sky}22`,
          borderRadius: 12, fontSize: 12, color: C.muted, lineHeight: 1.7, textAlign: 'center',
        }}>
          Still have a question?<br />
          <span style={{ color: C.sky, fontWeight: 700 }}>support@incynq.app</span>
        </div>
      </div>
    </div>
  );
}
