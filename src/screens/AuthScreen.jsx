import { useState } from 'react';
import C from '../theme';
import TCScreen from './TCScreen';
import logo from '../assets/Q_Logo_.png';
import { registerUser, loginUser, getProfile } from '../lib/db';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [slName, setSlName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreedTC, setAgreedTC] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    setError('');
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://incynq.app',
      });
      if (error) throw error;
      setResetSent(true);
    } catch (e) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!slName.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      // Look up email from SL avatar name
      const { data: emailData, error: rpcError } = await supabase
        .rpc('get_email_by_username', { p_username: slName.trim().toLowerCase() });

      if (rpcError || !emailData) {
        setError('Avatar not found. Check your SL name.');
        setLoading(false);
        return;
      }

      const data = await loginUser({ email: emailData, password });
      const profile = await getProfile(data.user.id);
      onLogin({
        id: data.user.id,
        username: profile.username,
        displayName: profile.display_name,
        name: profile.display_name,
        showDisplayName: profile.show_display_name,
        avatar: profile.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(profile.username)}&backgroundColor=b6e3f4`,
        bio: profile.bio || '',
        groups: profile.groups || [],
        subs: profile.subs || [],
        gridStatus: profile.grid_status || 'online',
        accountType: profile.account_type || 'resident',
        wallet: profile.wallet || 0,
        maturity: profile.maturity || 'general',
        activated: profile.activated,
        createdAt: profile.created_at,
      });
    } catch (e) {
      setError('Incorrect avatar name or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!slName.trim()) { setError('Enter your SL avatar name.'); return; }
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (!agreedTC) { setError('Please read and agree to the Terms & Conditions.'); return; }
    setLoading(true);
    try {
      const username = slName.trim().toLowerCase().replace(/ /g, '.');
      const { displayName } = await registerUser({ username, email, password });
      onLogin({
        id: Date.now(),
        username,
        displayName,
        name: displayName,
        showDisplayName: true,
        avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4`,
        bio: '', loc: '', groups: [], subs: [],
        gridStatus: 'online', accountType: 'resident',
        wallet: 0, maturity: 'general', activated: false,
      });
    } catch (e) {
      if (e.message?.includes('already registered')) {
        setError('This email is already registered. Try signing in.');
      } else {
        setError(e.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showTC && <TCScreen onClose={() => setShowTC(false)} />}
      
      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 24, maxWidth: 420, width: '100%', border: `1px solid ${C.border}`, boxShadow: '0 20px 60px #00000066' }}>
            {!resetSent ? (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>Forgot Password?</h3>
                <p style={{ fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 1.6 }}>
                  We'll send you a secure link that logs you in automatically. Once logged in, go to your <strong style={{ color: C.text }}>Profile → Settings → Change Password</strong> to set a new password.
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>EMAIL</label>
                  <input
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    type="email"
                    placeholder="your@email.com"
                    className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>
                {error && (
                  <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowForgotPassword(false); setResetEmail(''); setError(''); setResetSent(false); }}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, background: C.card2, color: C.sub, fontWeight: 700, fontSize: 13 }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleForgotPassword}
                    disabled={loading}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, background: loading ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: loading ? C.muted : '#060d14', fontWeight: 900, fontSize: 13 }}>
                    {loading ? '⏳ Sending…' : 'Send Reset Link'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 8 }}>Check Your Email</h3>
                  <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 12 }}>
                    We've sent a login link to <strong style={{ color: C.text }}>{resetEmail}</strong>
                  </p>
                  <div style={{ background: C.card2, borderRadius: 12, padding: 12, border: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
                      <strong style={{ color: C.text, display: 'block', marginBottom: 4 }}>📝 Remember:</strong>
                      After clicking the link and logging in, go to <strong style={{ color: C.text }}>Profile → Change Password</strong> to set a new password.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowForgotPassword(false); setResetEmail(''); setError(''); setResetSent(false); }}
                  style={{ width: '100%', padding: '11px', borderRadius: 12, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 13 }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 96, paddingBottom: 16 }}>
          <img src={logo} alt="InCynq" className="float"
            style={{ width: 100, height: 100, objectFit: 'contain', filter: `drop-shadow(0 0 24px ${C.sky}88)` }} />
          <span className="sg" style={{ fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            InCynq
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Form */}
        <div style={{ padding: '0 16px 40px' }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 22, border: `1px solid ${C.border}`, boxShadow: `0 0 40px ${C.sky}11` }}>

            {/* Tabs */}
            <div style={{ display: 'flex', background: C.card2, borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); setAgreedTC(false); }}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                    background: mode === m ? C.card : 'transparent',
                    color: mode === m ? C.text : C.muted,
                    boxShadow: mode === m ? '0 2px 8px #00000033' : 'none',
                    transition: 'all .2s' }}>
                  {m === 'login' ? 'Sign In' : 'Join InCynq'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* SL Avatar Name — always shown */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>SL AVATAR NAME</label>
                <input value={slName} onChange={e => setSlName(e.target.value)}
                  placeholder="firstname.lastname" className="inp"
                  onFocus={e => e.target.style.borderColor = C.sky}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>

              {/* Email — register only */}
              {mode === 'register' && (
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>EMAIL</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                    placeholder="your@email.com" className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              )}

              {/* Password */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>INCYNQ PASSWORD</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                  placeholder="Not your SL password" className="inp"
                  onFocus={e => e.target.style.borderColor = C.sky}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>InCynq never asks for your SL password.</div>
                {mode === 'login' && (
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <button
                      onClick={() => setShowForgotPassword(true)}
                      style={{ fontSize: 11, color: C.sky, fontWeight: 600, textDecoration: 'underline' }}>
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {/* Confirm — register only */}
              {mode === 'register' && (
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>CONFIRM PASSWORD</label>
                  <input value={confirm} onChange={e => setConfirm(e.target.value)} type="password"
                    placeholder="Repeat password" className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              )}

              {/* T&C — register only */}
              {mode === 'register' && (
                <div onClick={() => setAgreedTC(!agreedTC)}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', padding: '10px 12px',
                    background: agreedTC ? `${C.sky}0a` : C.card2,
                    border: `1px solid ${agreedTC ? C.sky + '44' : C.border}`,
                    borderRadius: 12, transition: 'all .2s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    border: `2px solid ${agreedTC ? C.sky : C.border}`,
                    background: agreedTC ? C.sky : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                    {agreedTC && <span style={{ color: '#040f14', fontSize: 13, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
                    I have read and agree to the{' '}
                    <button onClick={e => { e.stopPropagation(); setShowTC(true); }}
                      style={{ color: C.sky, fontWeight: 700, textDecoration: 'underline', fontSize: 13 }}>
                      Terms & Conditions
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button onClick={mode === 'login' ? handleLogin : handleRegister} disabled={loading}
                style={{ width: '100%', padding: '13px', borderRadius: 14,
                  background: loading ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`,
                  color: loading ? C.muted : '#060d14',
                  fontWeight: 900, fontSize: 14, marginTop: 4, transition: 'all .2s' }}>
                {loading
                  ? mode === 'register' ? '⏳ Creating your account…' : '⏳ Signing in…'
                  : mode === 'login' ? 'Sign In →' : 'Create Account →'}
              </button>
            </div>

            {/* T&C link on login */}
            {mode === 'login' && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <button onClick={() => setShowTC(true)} style={{ fontSize: 11, color: C.muted, textDecoration: 'underline' }}>
                  Terms & Conditions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
