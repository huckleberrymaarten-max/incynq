import { useState } from 'react';
import C from '../theme';

const LEVELS = [
  { id: 'general',  icon: '🟢', label: 'General',  desc: 'Family friendly content. Safe for all ages.',                    note: 'Default for all members.' },
  { id: 'moderate', icon: '🟡', label: 'Moderate', desc: 'Clubs, nightlife, mild adult themes. 16+ content.',              note: 'You can select this freely.' },
  { id: 'adult',    icon: '🔴', label: 'Adult',    desc: 'Adult content — 18+ only. Requires SL adult verification.',      note: 'Only available if your SL account is adult-verified at secondlife.com' },
];

export default function MaturityScreen({ currentUser, onClose, onUpdate }) {
  const [selected, setSelected] = useState(currentUser.maturity || 'general');
  const [adultChecks, setAdultChecks] = useState([false, false]);

  const handleSave = () => {
    if (selected === 'adult' && (!adultChecks[0] || !adultChecks[1])) return;
    onUpdate({ maturity: selected });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22 }}>←</button>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Maturity Level</span>
      </div>

      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, marginBottom: 20 }}>
          This controls what content you see on InCynq. Same levels as Second Life — you're in control.
        </div>

        {LEVELS.map(l => (
          <div key={l.id} onClick={() => setSelected(l.id)}
            style={{ background: selected === l.id ? (l.id === 'adult' ? '#ff444418' : `${C.sky}18`) : C.card, border: `2px solid ${selected === l.id ? (l.id === 'adult' ? '#ff4444' : C.sky) : C.border}`, borderRadius: 14, padding: 16, marginBottom: 10, cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{l.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: selected === l.id ? (l.id === 'adult' ? '#ff6644' : C.sky) : C.text, marginBottom: 3 }}>{l.label}</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{l.desc}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{l.note}</div>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${selected === l.id ? (l.id === 'adult' ? '#ff4444' : C.sky) : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selected === l.id && <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.id === 'adult' ? '#ff4444' : C.sky }} />}
              </div>
            </div>
          </div>
        ))}

        {selected === 'adult' && (
          <div style={{ background: '#ff440011', border: '1px solid #ff440033', borderRadius: 14, padding: 16, marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#ff6644', marginBottom: 12 }}>🔞 Adult verification required</div>
            {['My Second Life account is adult-verified at secondlife.com', 'I confirm I am 18 years of age or older'].map((text, i) => (
              <div key={i} onClick={() => setAdultChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${adultChecks[i] ? '#ff4444' : C.border}`, background: adultChecks[i] ? '#ff444433' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {adultChecks[i] && <span style={{ color: '#ff4444', fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
            <button onClick={() => window.open('https://secondlife.com/my/account/verify', '_blank')}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid #ff444444', color: '#ff8866', fontWeight: 700, fontSize: 12, marginTop: 4 }}>
              Verify on Second Life →
            </button>
          </div>
        )}

        <button onClick={handleSave}
          disabled={selected === 'adult' && (!adultChecks[0] || !adultChecks[1])}
          style={{ width: '100%', padding: '13px', borderRadius: 14, marginTop: 16, background: selected === 'adult' && (!adultChecks[0] || !adultChecks[1]) ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: selected === 'adult' && (!adultChecks[0] || !adultChecks[1]) ? C.muted : '#060d14', fontWeight: 900, fontSize: 14, transition: 'all .2s' }}>
          Save Maturity Level →
        </button>

        <div style={{ marginTop: 14, padding: '10px 14px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 10, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          💡 Your maturity level is private. It controls what you see — not what others see on your profile.
        </div>
      </div>
    </div>
  );
}
