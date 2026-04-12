import { useState } from 'react';
import C from '../theme';
import { ME } from '../data';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | register
  const [slName, setSlName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError('');
    if (!slName.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Test account
      if (slName.trim().toLowerCase() === 'maarten.huckleberry') {
        onLogin({ ...ME, activated: true });
        return;
      }
      setError('Avatar not found. Try maarten.huckleberry for the demo.');
    }, 900);
  };

  const handleRegister = () => {
    setError('');
    if (!slName.trim()) { setError('Enter your SL avatar name.'); return; }
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const fetchedDisplayName = slName.trim().split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    setTimeout(() => {
      setLoading(false);
      onLogin({
        id: Date.now(),
        username: slName.trim().toLowerCase().replace(/ /g, '.'),
        displayName: fetchedDisplayName,
        name: fetchedDisplayName,
        showDisplayName: true,
        avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(slName)}&backgroundColor=b6e3f4`,
        bio: '', loc: '', groups: [], subs: [],
        gridStatus: 'online', accountType: 'resident',
        wallet: 0, maturity: 'general', activated: false,
      });
    }, 1400);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${C.sky}55`, margin: '0 auto 12px', fontSize: 28 }}>⚡</div>
        <div className="sg" style={{ fontWeight: 900, fontSize: 24, background: `linear-gradient(135deg,${C.sky},${C.lavender})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 2, letterSpacing: 1 }}>Connect with what matters.</div>
      </div>

      <div style={{ background: C.card, borderRadius: 24, padding: 22, width: '100%', maxWidth: 400, border: `1px solid ${C.border}`, boxShadow: `0 0 40px ${C.sky}11` }} className="fadeUp">
        {/* Tabs */}
        <div style={{ display: 'flex', background: C.card2, borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: mode === m ? C.card : 'transparent', color: mode === m ? C.text : C.muted, boxShadow: mode === m ? `0 2px 8px #00000033` : 'none', transition: 'all .2s' }}>
              {m === 'login' ? 'Sign In' : 'Join InCynq'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>SL AVATAR NAME</label>
            <input value={slName} onChange={e => setSlName(e.target.value)}
              placeholder="e.g. maarten.huckleberry"
              className="inp"
              onFocus={e => e.target.style.borderColor = C.sky}
              onBlur={e => e.target.style.borderColor = C.border} />
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>EMAIL</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="your@email.com" className="inp"
                onFocus={e => e.target.style.borderColor = C.sky}
                onBlur={e => e.target.style.borderColor = C.border} />
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>INCYNQ PASSWORD</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password"
              placeholder="Not your SL password" className="inp"
              onFocus={e => e.target.style.borderColor = C.sky}
              onBlur={e => e.target.style.borderColor = C.border} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>InCynq never asks for your SL password.</div>
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>CONFIRM PASSWORD</label>
              <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password"
                placeholder="Repeat password" className="inp"
                onFocus={e => e.target.style.borderColor = C.sky}
                onBlur={e => e.target.style.borderColor = C.border} />
            </div>
          )}

          {error && (
            <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: 14, background: loading ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: loading ? C.muted : '#060d14', fontWeight: 900, fontSize: 14, marginTop: 4, transition: 'all .2s' }}>
            {loading
              ? mode === 'register' ? '⏳ Fetching your SL profile…' : '⏳ Signing in…'
              : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </div>

        {mode === 'login' && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 10, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            Demo: use <strong style={{ color: C.sky }}>maarten.huckleberry</strong> with any password.
          </div>
        )}
      </div>
    </div>
  );
}
