import { useState } from 'react';
import C from '../theme';
import { setAdultVerified } from '../lib/db';
import { useApp } from '../context/AppContext';

const LEVELS = [
  { id: 'general',  icon: '🟢', label: 'General',  desc: 'Family friendly content. Safe for all ages.',               note: 'Always on — cannot be disabled.', locked: true },
  { id: 'moderate', icon: '🟡', label: 'Moderate', desc: 'Clubs, nightlife, mild adult themes. 16+ content.',         note: 'Toggle freely.', locked: false },
  { id: 'adult',    icon: '🔴', label: 'Adult',    desc: 'Adult content — 18+ only. Requires SL adult verification.', note: 'Only available if your SL account is adult-verified.', locked: false },
];

export default function MaturityScreen({ onClose, onUpdate }) {
  const { currentUser, setCurrentUser } = useApp();

  const initial = (() => {
    let m = currentUser.maturity;
    if (!m) return ['general'];
    if (typeof m === 'string') {
      if (m.startsWith('[')) { try { m = JSON.parse(m); } catch { m = [m]; } }
      else m = [m];
    }
    if (!Array.isArray(m)) m = ['general'];
    // Flatten in case of double-encoding
    const flat = m.flatMap(x => {
      if (typeof x === 'string' && x.startsWith('[')) {
        try { return JSON.parse(x); } catch { return [x]; }
      }
      return [x];
    }).filter(x => ['general', 'moderate', 'adult'].includes(x));
    if (!flat.includes('general')) flat.unshift('general');
    return flat;
  })();

  const [selected, setSelected] = useState(initial);
  const [adultChecks, setAdultChecks] = useState([false, false]);
  const [showAdultVerify, setShowAdultVerify] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const toggle = id => {
    if (id === 'general') return; // always on
    if (id === 'adult') {
      if (selected.includes('adult')) {
        setSelected(prev => prev.filter(x => x !== 'adult'));
        setShowAdultVerify(false);
      } else {
        setShowAdultVerify(true);
      }
      return;
    }
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const confirmAdult = async () => {
    if (!adultChecks[0] || !adultChecks[1]) return;
    setVerifying(true);
    setVerifyError('');
    try {
      await setAdultVerified(currentUser.id);
      setCurrentUser(u => ({ ...u, adultVerified: true }));
      setSelected(prev => [...prev, 'adult']);
      setShowAdultVerify(false);
    } catch (e) {
      setVerifyError('Something went wrong — please try again.');
      console.error('Adult verify failed:', e.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    // Ensure maturity is always a clean flat array of strings
    const cleanMaturity = selected.flatMap(m => {
      if (typeof m === 'string' && m.startsWith('[')) {
        try { return JSON.parse(m); } catch { return [m]; }
      }
      return [m];
    }).filter(m => ['general', 'moderate', 'adult'].includes(m));
    // Always include general
    if (!cleanMaturity.includes('general')) cleanMaturity.unshift('general');
    onUpdate({ maturity: cleanMaturity });
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
          Choose which content levels you want to see. Same as Second Life — you're in control.
        </div>

        {LEVELS.map(l => {
          const isOn = l.locked ? true : selected.includes(l.id);
          const isAdult = l.id === 'adult';
          return (
            <div key={l.id} onClick={() => toggle(l.id)}
              style={{ background: isOn ? (isAdult ? '#ff444418' : `${C.sky}18`) : C.card, border: `2px solid ${isOn ? (isAdult ? '#ff4444' : C.sky) : C.border}`, borderRadius: 14, padding: 16, marginBottom: 10, cursor: l.locked ? 'default' : 'pointer', transition: 'all .2s', opacity: l.locked ? 1 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{l.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: isOn ? (isAdult ? '#ff6644' : C.sky) : C.text, marginBottom: 3 }}>{l.label}</div>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{l.desc}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{l.note}</div>
                </div>
                {/* Checkbox */}
                <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isOn ? (isAdult ? '#ff4444' : C.sky) : C.border}`, background: isOn ? (isAdult ? '#ff4444' : C.sky) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
                  {isOn && <span style={{ color: '#060d14', fontSize: 14, fontWeight: 900 }}>✓</span>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Adult verification panel */}
        {showAdultVerify && (
          <div style={{ background: '#ff440011', border: '1px solid #ff440033', borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#ff6644', marginBottom: 8 }}>🔞 Adult verification required</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 12 }}>
              InCynq uses the same adult access standard as Second Life — payment info on file with Linden Lab is required. Random checks are carried out. If we find you don't meet the requirement, your Adult access will be removed until you can show us payment info is on file.
            </div>
            {[
              'My Second Life account has payment info on file with Linden Lab',
              'I confirm I am 18 years of age or older'
            ].map((text, i) => (
              <div key={i} onClick={() => setAdultChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${adultChecks[i] ? '#ff4444' : C.border}`, background: adultChecks[i] ? '#ff444433' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {adultChecks[i] && <span style={{ color: '#ff4444', fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
            <button onClick={() => window.open('https://cashier.secondlife.com/addpm', '_blank')}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid #ff444444', color: '#ff8866', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
              Add payment info on Second Life →
            </button>
            {verifyError && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 10 }}>{verifyError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowAdultVerify(false); setAdultChecks([false, false]); }}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={confirmAdult}
                disabled={!adultChecks[0] || !adultChecks[1] || verifying}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: !adultChecks[0] || !adultChecks[1] ? C.border : '#ff4444', color: !adultChecks[0] || !adultChecks[1] ? C.muted : '#fff', fontWeight: 700, fontSize: 13, opacity: verifying ? 0.6 : 1 }}>
                {verifying ? 'Verifying…' : 'Confirm Adult ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Current selection summary */}
        <div style={{ padding: '12px 14px', background: C.card2, borderRadius: 12, marginBottom: 20, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          💡 You will see: <strong style={{ color: C.text }}>{selected.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}</strong> content.
          <br />Your level is private — others cannot see it.
        </div>

        <button onClick={handleSave}
          style={{ width: '100%', padding: '13px', borderRadius: 14, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 14 }}>
          Save →
        </button>
      </div>
    </div>
  );
}
