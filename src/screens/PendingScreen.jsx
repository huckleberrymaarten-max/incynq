import { useState } from 'react';
import C from '../theme';
import { visibleName } from '../data';
import { supabase } from '../lib/supabase';
import { processReferralReward } from '../lib/db';

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

export default function PendingScreen({ currentUser, onActivate, onSignOut }) {
  const [simulating, setSimulating] = useState(false);
  const [status, setStatus] = useState('');

  const handleSimulate = async () => {
    setSimulating(true);
    setStatus('Connecting to Second Life…');

    // Try to fetch SL profile picture automatically
    const slAvatar = await fetchSLAvatar(currentUser.username);

    setStatus('Activating account…');
    await new Promise(r => setTimeout(r, 800));

    // Save activation + 100 L$ welcome credit to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const updates = {
          activated:         true,
          activated_at:      new Date().toISOString(),
          wallet:            100,
          welcome_credit_at: new Date().toISOString(),
        };
        if (slAvatar) updates.avatar_url = slAvatar;
        await supabase.from('profiles').update(updates).eq('id', session.user.id);
        
        // Process referral reward (if user was referred)
        try {
          const rewardPaid = await processReferralReward(session.user.id);
          if (rewardPaid) {
            console.log('Referral reward paid to referrer!');
          }
        } catch (error) {
          console.warn('Referral reward check failed:', error.message);
          // Don't block activation if referral reward fails
        }
      }
    } catch (e) {
      console.log('Could not save activation:', e.message);
    }

    // Activate locally — wallet: 100 passed through so ProfileScreen shows it immediately
    onActivate(slAvatar ? { avatar: slAvatar } : {});
    setSimulating(false);
    setStatus('');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${C.sky}66`, margin: '0 auto 12px', fontSize: 32 }}>🏧</div>
        <div className="sg" style={{ fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</div>
      </div>

      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div className="sg" style={{ fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 10 }}>You are almost in.</div>
        <div style={{ fontSize: 15, color: C.sub, lineHeight: 1.8, marginBottom: 28 }}>
          One last step. Pop inworld and tap an <strong style={{ color: C.sky }}>InCynq terminal</strong> to confirm it is really you.
        </div>

        {/* Steps */}
        <div style={{ background: C.card, borderRadius: 18, padding: 20, marginBottom: 20, textAlign: 'left', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>HOW TO ACTIVATE</div>
          {[
            { n: '1', icon: '🔍', text: 'Find an InCynq terminal inworld in Second Life.' },
            { n: '2', icon: '👆', text: 'Walk up and tap it. We will recognise you instantly.' },
            { n: '3', icon: '✅', text: 'Come back here. Your account will be waiting.' },
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

        {/* Welcome credit notice */}
        <div style={{ padding: '10px 14px', background: `${C.gold}0a`, border: `1px solid ${C.gold}33`, borderRadius: 12, marginBottom: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          🎁 <strong style={{ color: C.gold }}>100 L$ welcome credit</strong> will be added to your wallet on activation.
        </div>

        {/* Account info */}
        <div style={{ background: C.card2, borderRadius: 14, padding: '12px 16px', marginBottom: 20, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={currentUser.avatar} alt="" style={{ width: 42, height: 42, borderRadius: '18%', border: `2px solid ${C.sky}`, flexShrink: 0, objectFit: 'cover' }} />
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visibleName(currentUser)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>@{currentUser.username}</div>
          </div>
          <span style={{ fontSize: 11, background: '#ff8c0018', color: '#ff8c00', border: '1px solid #ff8c0033', padding: '3px 10px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>⏳ Pending</span>
        </div>

        {/* Demo note */}
        <div style={{ padding: '10px 14px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 12, marginBottom: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          🛠️ <strong style={{ color: C.sky }}>Prototype:</strong> Tap below to simulate inworld terminal activation. Your SL profile picture will load automatically.
        </div>

        <button onClick={handleSimulate} disabled={simulating}
          style={{ width: '100%', padding: '14px', borderRadius: 16, background: simulating ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: simulating ? C.muted : '#060d14', fontWeight: 900, fontSize: 15, marginBottom: 10, transition: 'all .2s', boxShadow: simulating ? 'none' : `0 0 24px ${C.sky}44` }}>
          {simulating ? `⏳ ${status}` : "✓ I've tapped the terminal →"}
        </button>

        <button onClick={onSignOut} style={{ width: '100%', padding: '11px', borderRadius: 14, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 13 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
