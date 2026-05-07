import { useState, useEffect, useRef } from 'react';
import C from '../theme';
import TCScreen from './TCScreen';
import logo from '../assets/Q_Logo_.png';
import { registerUser, loginUser, getProfile, createReferral } from '../lib/db';
import { fetchSLProfile } from '../lib/slProfile';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [slName, setSlName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agreedTC, setAgreedTC] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotSlName, setForgotSlName] = useState('');
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotCode, setForgotCode]     = useState('');
  const [forgotSent, setForgotSent]     = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // ── SL profile lookup (register mode only) ──────────────────────
  // Fires when the user stops typing their SL name for 800ms.
  // Populates displayName + pictureUrl before the form is submitted.
  const [slLookup, setSlLookup]           = useState(null);   // { uuid, username, displayName, pictureUrl } | null
  const [slLookupLoading, setSlLookupLoading] = useState(false);
  const [slLookupError, setSlLookupError]     = useState('');
  const lookupTimer = useRef(null);

  useEffect(() => {
    // Only runs in register mode
    if (mode !== 'register') return;

    // Reset when name is cleared or too short
    setSlLookup(null);
    setSlLookupError('');
    if (slName.trim().length < 3) return;

    clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      setSlLookupLoading(true);
      try {
        const data = await fetchSLProfile(slName.trim());
        setSlLookup(data);
        setSlLookupError('');
      } catch (e) {
        setSlLookup(null);
        setSlLookupError(e.message || 'Avatar not found — double-check your SL name.');
      } finally {
        setSlLookupLoading(false);
      }
    }, 800);

    return () => clearTimeout(lookupTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slName, mode]);

  // Reset lookup when switching modes
  const switchMode = (m) => {
    setMode(m);
    setError('');
    setAgreedTC(false);
    setSlLookup(null);
    setSlLookupError('');
    clearTimeout(lookupTimer.current);
  };

  // ── Login ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!slName.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
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
        referralCode: profile.referral_code,
      });
    } catch (e) {
      setError('Incorrect avatar name or password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Register ─────────────────────────────────────────────────────
  const handleRegister = async () => {
    setError('');
    if (!slName.trim())     { setError('Enter your SL avatar name.'); return; }
    if (!email.trim())      { setError('Enter your email.'); return; }
    if (password.length < 6){ setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm){ setError("Passwords don't match."); return; }
    if (!agreedTC)          { setError('Please read and agree to the Terms & Conditions.'); return; }

    setLoading(true);
    try {
      const username  = slName.trim().toLowerCase().replace(/ /g, '.');
      const authData  = await registerUser({ username, email, password });
      const userId    = authData.user?.id;

      // ── Override display name + avatar with real SL data ────────
      // registerUser derives displayName from the username (capitalised words).
      // If we successfully looked up the avatar, we overwrite with the real
      // SL display name and profile picture.
      const resolvedDisplayName = slLookup?.displayName ?? authData.displayName;
      const resolvedAvatarUrl   = slLookup?.pictureUrl  ?? null;

      if (userId && (slLookup?.displayName || slLookup?.pictureUrl)) {
        try {
          const updates = {};
          if (slLookup.displayName) updates.display_name = slLookup.displayName;
          if (slLookup.pictureUrl)  updates.avatar_url   = slLookup.pictureUrl;

          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        } catch (e) {
          // Non-fatal — profile still works, just without the SL overrides
          console.warn('Could not save SL profile data:', e.message);
        }
      }

      // Create referral record if code provided
      if (referralCode.trim() && userId) {
        try {
          await createReferral(referralCode.trim().toUpperCase(), userId);
        } catch (e) {
          console.warn('Referral code invalid or already used:', e.message);
        }
      }

      onLogin({
        id:              userId || Date.now(),
        username,
        displayName:     resolvedDisplayName,
        name:            resolvedDisplayName,
        showDisplayName: true,
        avatar:          resolvedAvatarUrl
          || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4`,
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

  // ── Forgot password ───────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!forgotSlName.trim()) { setError('Enter your SL avatar name.'); return; }
    setForgotLoading(true);
    setError('');
    try {
      const { data: emailData, error: rpcError } = await supabase
        .rpc('get_email_by_username', { p_username: forgotSlName.trim().toLowerCase() });
      if (rpcError || !emailData) {
        setError('Avatar not found. Check your SL name.');
        setForgotLoading(false);
        return;
      }
      await supabase.auth.resetPasswordForEmail(emailData, {
        redirectTo: window.location.origin,
      });
      setForgotEmail(emailData);
      setForgotSent(true);
    } catch (e) {
      setError('Could not send code. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!forgotCode.trim()) { setError('Enter the code from your email.'); return; }
    setForgotLoading(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: forgotCode.trim(),
        type:  'recovery',
      });
      if (verifyError) throw verifyError;
      // Logged in — close the sheet and let App.jsx hydrate the profile
      setShowForgotPassword(false);
      if (data?.user?.id) {
        onLogin({ id: data.user.id });
      }
    } catch (e) {
      setError('Incorrect or expired code. Check your email and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      {showTC && <TCScreen onClose={() => setShowTC(false)} />}

      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 96, paddingBottom: 16 }}>
          <img src={logo} alt="InCynq" className="float"
            style={{ width: 100, height: 100, objectFit: 'contain', filter: `drop-shadow(0 0 24px ${C.sky}88)` }} />
          <span className="sg" style={{ fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            InCynq
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Form */}
        <div style={{ padding: '0 16px 40px' }}>
          <div style={{ background: C.card, borderRadius: 24, padding: 22, border: `1px solid ${C.border}`, boxShadow: `0 0 40px ${C.sky}11` }}>

            {/* Tabs */}
            <div style={{ display: 'flex', background: C.card2, borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => switchMode(m)}
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

              {/* SL Avatar Name */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>SL AVATAR NAME</label>
                <input value={slName} onChange={e => setSlName(e.target.value)}
                  placeholder="firstname.lastname" className="inp"
                  onFocus={e => e.target.style.borderColor = C.sky}
                  onBlur={e => e.target.style.borderColor = C.border} />

                {/* ── SL lookup feedback (register only) ── */}
                {mode === 'register' && slName.trim().length >= 3 && (
                  <div style={{ marginTop: 6 }}>
                    {slLookupLoading && (
                      <div style={{ fontSize: 12, color: C.muted, padding: '6px 10px' }}>
                        ⏳ Looking up avatar…
                      </div>
                    )}

                    {!slLookupLoading && slLookup && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 10,
                        background: `${C.sky}0a`, border: `1px solid ${C.sky}33`,
                      }}>
                        <img
                          src={slLookup.pictureUrl}
                          alt=""
                          style={{
                            width: 36, height: 36, borderRadius: '18%',
                            objectFit: 'cover', border: `1.5px solid ${C.sky}44`,
                            flexShrink: 0,
                          }}
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.sky, letterSpacing: .3 }}>
                            ✓ AVATAR FOUND
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 1 }}>
                            {slLookup.displayName}
                          </div>
                        </div>
                      </div>
                    )}

                    {!slLookupLoading && slLookupError && (
                      <div style={{
                        fontSize: 12, color: '#ff8866', padding: '6px 10px',
                        background: '#ff440008', borderRadius: 8,
                        border: '1px solid #ff440022',
                      }}>
                        ⚠ {slLookupError}
                      </div>
                    )}
                  </div>
                )}
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
                  <button onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotSlName(''); setError(''); }}
                    style={{ fontSize: 11, color: C.sky, fontWeight: 600, textAlign: 'right', display: 'block', marginTop: 4, marginLeft: 'auto' }}>
                    Forgot password?
                  </button>
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

              {/* Referral Code — register only, optional */}
              {mode === 'register' && (
                <div>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>REFERRAL CODE (OPTIONAL)</label>
                  <input value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter code if you have one" className="inp"
                    onFocus={e => e.target.style.borderColor = C.sky}
                    onBlur={e => e.target.style.borderColor = C.border}
                    maxLength={30} />
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Referred by a friend? Enter their code here.</div>
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

      {/* Forgot Password sheet */}
      {showForgotPassword && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowForgotPassword(false)}>
          <div style={{ background: '#0d1f2d', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()} className="fadeUp">
            {forgotSent ? (
              <>
                <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📬</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', textAlign: 'center', marginBottom: 8 }}>Check your inbox</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.7, marginBottom: 20 }}>
                  We've sent a 6-digit code to your email. Enter it below to sign in — then change your password in Settings.
                </div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>YOUR CODE</label>
                <input
                  value={forgotCode}
                  onChange={e => { setForgotCode(e.target.value); setError(''); }}
                  placeholder="Enter 6-digit code"
                  className="inp"
                  style={{ marginBottom: 12, letterSpacing: 4, fontWeight: 800, fontSize: 18, textAlign: 'center' }}
                  maxLength={10}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
                {error && (
                  <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    {error}
                  </div>
                )}
                <button onClick={handleVerifyCode} disabled={forgotLoading || !forgotCode.trim()}
                  style={{ width: '100%', padding: '13px', borderRadius: 14, background: forgotLoading || !forgotCode.trim() ? 'rgba(0,180,200,0.1)' : 'linear-gradient(135deg,#00B4C8,#F4B942)', color: forgotLoading || !forgotCode.trim() ? 'rgba(255,255,255,0.4)' : '#060d14', fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
                  {forgotLoading ? '⏳ Verifying…' : 'Sign in →'}
                </button>
                <button onClick={() => { setForgotSent(false); setForgotCode(''); setError(''); }}
                  style={{ width: '100%', padding: '10px', borderRadius: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>
                  Resend code
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🔑</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', textAlign: 'center', marginBottom: 8 }}>Reset your password</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.7, marginBottom: 20 }}>
                  Enter your SL avatar name and we'll send a sign-in code to your email.
                </div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>SL AVATAR NAME</label>
                <input value={forgotSlName} onChange={e => setForgotSlName(e.target.value)}
                  placeholder="firstname.lastname" className="inp" style={{ marginBottom: 12 }} />
                {error && (
                  <div style={{ padding: '9px 12px', background: '#ff440011', border: '1px solid #ff440044', borderRadius: 10, color: '#ff6644', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    {error}
                  </div>
                )}
                <button onClick={handleForgotPassword} disabled={forgotLoading}
                  style={{ width: '100%', padding: '13px', borderRadius: 14, background: forgotLoading ? 'rgba(0,180,200,0.1)' : 'linear-gradient(135deg,#00B4C8,#F4B942)', color: forgotLoading ? 'rgba(255,255,255,0.4)' : '#060d14', fontWeight: 800, fontSize: 14 }}>
                  {forgotLoading ? '⏳ Sending…' : 'Send code →'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
