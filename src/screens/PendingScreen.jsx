import { useState, useEffect, useRef } from 'react';
import C from '../theme';
import { visibleName } from '../data';
import { supabase } from '../lib/supabase';
import {
  createActivationCode,
  subscribeToProfile,
  refreshProfile,
  processReferralReward,
} from '../lib/db';

// Fetch SL profile picture using avatar username
const fetchSLAvatar = async (username) => {
  try {
    const res = await fetch(
      `https://corsproxy.io/?https://my-secondlife.com/agents/${encodeURIComponent(username)}/about`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/profile_image[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// Format remaining time (24h → "23h 45m")
const formatTimeLeft = (expiresAt) => {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return 'expired';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function PendingScreen({ currentUser, onActivate, onSignOut }) {
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const unsubRef = useRef(null);

  // ── Fetch the activation code on mount ──
  const loadCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createActivationCode(currentUser.id);
      setCode(result.code);
      setExpiresAt(result.expires_at);
    } catch (e) {
      console.error('Failed to load activation code:', e);
      setError(e.message || 'Could not generate activation code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle activation completion (called when profile.activated flips to true) ──
  const handleActivationDetected = async (newProfile) => {
    if (!newProfile?.activated) return;

    // Try to fetch SL avatar picture (best-effort, non-blocking)
    let slAvatar = null;
    try {
      slAvatar = await fetchSLAvatar(currentUser.username);
    } catch {}

    // Update avatar URL if we got one
    if (slAvatar) {
      try {
        await supabase
          .from('profiles')
          .update({ avatar_url: slAvatar })
          .eq('id', currentUser.id);
      } catch (e) {
        console.warn('Could not save avatar URL:', e.message);
      }
    }

    // Process referral reward (if user was referred)
    try {
      const rewardPaid = await processReferralReward(currentUser.id);
      if (rewardPaid) console.log('Referral reward paid to referrer.');
    } catch (e) {
      console.warn('Referral reward processing failed:', e.message);
    }

    // Tell the app we're activated
    onActivate(slAvatar ? { avatar: slAvatar } : {});
  };

  // ── Mount: load code + subscribe to profile changes ──
  useEffect(() => {
    loadCode();

    // Subscribe to profile updates (real-time)
    unsubRef.current = subscribeToProfile(currentUser.id, (newProfile) => {
      handleActivationDetected(newProfile);
    });

    // Fallback: poll every 5 seconds in case the subscription misses an event
    const pollInterval = setInterval(async () => {
      const profile = await refreshProfile(currentUser.id);
      if (profile?.activated) {
        handleActivationDetected(profile);
      }
    }, 5000);

    return () => {
      if (unsubRef.current) unsubRef.current();
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  // ── Update countdown timer every minute ──
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setTimeLeft(formatTimeLeft(expiresAt));
    update();
    const tick = setInterval(update, 60000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  // ── Copy code to clipboard ──
  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently fail
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/Q_Logo_.png" alt="InCynq" style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 12px', display: 'block', filter: `drop-shadow(0 0 24px ${C.sky}66)` }} />
        <div className="sg" style={{ fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</div>
      </div>

      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div className="sg" style={{ fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 10 }}>You are almost in.</div>
        <div style={{ fontSize: 15, color: C.sub, lineHeight: 1.8, marginBottom: 28 }}>
          One last step. Pop inworld and tap an <strong style={{ color: C.sky }}>InCynq terminal</strong> to confirm it is really you.
        </div>

        {/* ─── ACTIVATION CODE ─── */}
        <div style={{ background: C.card, borderRadius: 18, padding: 20, marginBottom: 20, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>YOUR ACTIVATION CODE</div>

          {loading && (
            <div style={{ padding: '24px 0', color: C.muted, fontSize: 14 }}>
              ⏳ Generating your code…
            </div>
          )}

          {error && !loading && (
            <div>
              <div style={{ padding: '14px 0', color: C.peach, fontSize: 13, lineHeight: 1.6 }}>
                ⚠ {error}
              </div>
              <button onClick={loadCode}
                style={{ padding: '8px 16px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          )}

          {code && !loading && (
            <>
              <button onClick={handleCopyCode}
                style={{
                  width: '100%',
                  padding: '16px 12px',
                  borderRadius: 14,
                  background: C.card2,
                  border: `2px dashed ${C.sky}66`,
                  color: C.sky,
                  fontWeight: 900,
                  fontSize: 28,
                  letterSpacing: 4,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all .2s',
                  marginBottom: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.sky; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${C.sky}66`; }}>
                {code}
              </button>
              <div style={{ fontSize: 11, color: copied ? C.sky : C.muted, transition: 'color .2s' }}>
                {copied ? '✓ Copied to clipboard' : 'Tap to copy'}
                {timeLeft && !copied && (
                  <span style={{ color: C.muted }}> · expires in {timeLeft}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── STEPS ─── */}
        <div style={{ background: C.card, borderRadius: 18, padding: 20, marginBottom: 20, textAlign: 'left', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>HOW TO ACTIVATE</div>
          {[
            { n: '1', icon: '🔍', text: 'Find an InCynq terminal inworld in Second Life.' },
            { n: '2', icon: '👆', text: 'Tap the terminal. A box will pop up — paste your code there.' },
            { n: '3', icon: '✅', text: 'Come back here. Your account will activate automatically.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, color: '#060d14', fontWeight: 900 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{s.icon} Step {s.n}</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── WELCOME CREDIT NOTICE ─── */}
        <div style={{ padding: '10px 14px', background: `${C.gold}0a`, border: `1px solid ${C.gold}33`, borderRadius: 12, marginBottom: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          🎁 <strong style={{ color: C.gold }}>100 L$ welcome credit</strong> will be added to your wallet on activation.
        </div>

        {/* ─── ACCOUNT INFO ─── */}
        <div style={{ background: C.card2, borderRadius: 14, padding: '12px 16px', marginBottom: 20, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={currentUser.avatar} alt="" style={{ width: 42, height: 42, borderRadius: '18%', border: `2px solid ${C.sky}`, flexShrink: 0, objectFit: 'cover' }} />
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visibleName(currentUser)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>@{currentUser.username}</div>
          </div>
          <span style={{ fontSize: 11, background: '#ff8c0018', color: '#ff8c00', border: '1px solid #ff8c0033', padding: '3px 10px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>⏳ Pending</span>
        </div>

        {/* ─── WAITING INDICATOR ─── */}
        {code && !loading && !error && (
          <div style={{ padding: '12px 14px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 12, marginBottom: 20, fontSize: 12, color: C.muted, lineHeight: 1.6, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.sky, marginRight: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
            Waiting for inworld activation…
          </div>
        )}

        <button onClick={onSignOut}
          style={{ width: '100%', padding: '11px', borderRadius: 14, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>

      {/* Pulse animation for the waiting dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
