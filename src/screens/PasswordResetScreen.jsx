import { useState } from 'react';
import C from '../theme';
import logo from '../assets/Q_Logo_.png';
import { supabase } from '../lib/supabase';

/**
 * PasswordResetScreen
 * ────────────────────
 * Shown when the user arrives back at the app via a Supabase
 * password-reset magic link (type=recovery in the URL hash).
 *
 * Supabase has already parsed the token and established a session
 * by the time this screen renders — we just need to call
 * supabase.auth.updateUser({ password }) to set the new password.
 */
export default function PasswordResetScreen({ onDone }) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Could not update password — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:      '100vh',
      background:     C.bg,
      display:        'flex',
      flexDirection:  'column',
      maxWidth:       480,
      margin:         '0 auto',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 96, paddingBottom: 16 }}>
        <img src={logo} alt="InCynq" className="float"
          style={{ width: 100, height: 100, objectFit: 'contain', filter: `drop-shadow(0 0 24px ${C.sky}88)` }} />
        <span className="sg" style={{ fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          InCynq
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 16px 40px' }}>
        <div style={{ background: C.card, borderRadius: 24, padding: 22, border: `1px solid ${C.border}`, boxShadow: `0 0 40px ${C.sky}11` }}>

          {success ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div className="sg" style={{ fontWeight: 800, fontSize: 20, color: C.text, marginBottom: 10 }}>
                Password updated!
              </div>
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 24 }}>
                Your new password is set. You can now sign in.
              </div>
              <button
                onClick={onDone}
                style={{
                  width:        '100%',
                  padding:      '13px',
                  borderRadius: 14,
                  background:   `linear-gradient(135deg,${C.sky},${C.peach})`,
                  color:        '#060d14',
                  fontWeight:   900,
                  fontSize:     14,
                }}
              >
                Go to Sign In →
              </button>
            </div>
          ) : (
            /* ── Set password form ── */
            <>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
                <div className="sg" style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 6 }}>
                  Set a new password
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  Choose something you'll remember.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>
                    NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>

                {error && (
                  <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    width:        '100%',
                    padding:      '13px',
                    borderRadius: 14,
                    background:   loading ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`,
                    color:        loading ? C.muted : '#060d14',
                    fontWeight:   900,
                    fontSize:     14,
                    marginTop:    4,
                    transition:   'all .2s',
                  }}
                >
                  {loading ? '⏳ Saving…' : 'Set new password →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
