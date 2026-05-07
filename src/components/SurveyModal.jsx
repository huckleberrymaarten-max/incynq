import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

// ── Questions ─────────────────────────────────────────────────────────
const USAGE_OPTIONS    = ['Daily', 'A few times a week', 'Weekly', 'Less often'];
const RELEVANCE_OPTIONS = ['Always', 'Usually', 'Sometimes', 'Rarely'];

const SATISFACTION_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Very unhappy' },
  { value: 2, emoji: '😕', label: 'Unhappy' },
  { value: 3, emoji: '🙂', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Happy' },
  { value: 5, emoji: '🤩', label: 'Love it!' },
];

const TOTAL_STEPS = 6;

export default function SurveyModal({ onClose }) {
  const { currentUser, setCurrentUser, toast } = useApp();
  const [step, setStep]         = useState(0);
  const [q1, setQ1]             = useState(null);
  const [q2, setQ2]             = useState(null);
  const [q3, setQ3]             = useState(null);
  const [q4, setQ4]             = useState(currentUser.groups || []);
  const [q5, setQ5]             = useState('');
  const [q6, setQ6]             = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  const progress = Math.round(((step) / TOTAL_STEPS) * 100);

  const canNext = () => {
    if (step === 0) return q1 !== null;
    if (step === 1) return q2 !== null;
    if (step === 2) return q3 !== null;
    if (step === 3) return true; // interests optional
    if (step === 4) return true; // feedback optional
    if (step === 5) return q6 !== null;
    return false;
  };

  const handleDismiss = async () => {
    try {
      await supabase.rpc('dismiss_survey', { p_user_id: currentUser.id });
    } catch (e) {
      console.warn('Survey dismiss failed:', e.message);
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    setSubmitting(true);
    try {
      await supabase.rpc('submit_survey', {
        p_user_id: currentUser.id,
        p_q1:      q1,
        p_q2:      q2,
        p_q3:      q3,
        p_q4:      q4,
        p_q5:      q5.trim() || null,
        p_q6:      q6,
      });
      // Award 10 L$ in local state
      setCurrentUser(u => ({ ...u, wallet: (u.wallet || 0) + 10 }));
      setDone(true);
    } catch (e) {
      console.error('Survey submit failed:', e.message);
      toast('Could not submit survey — try again', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleSubmit();
  };

  // ── Done screen ────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={overlay}>
        <div style={card} className="fadeUp">
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div className="sg" style={{ fontWeight: 900, fontSize: 22, color: C.text, marginBottom: 10 }}>
              Thank you!
            </div>
            <div style={{ fontSize: 15, color: C.sub, lineHeight: 1.7, marginBottom: 24 }}>
              Your feedback helps shape InCynq. We really appreciate it.
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.gold}22, ${C.peach}11)`, border: `1px solid ${C.gold}44`, borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>REWARD</div>
              <div className="sg" style={{ fontSize: 26, fontWeight: 900, color: C.gold }}>+10 L$</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Added to your InCynq wallet</div>
            </div>
            <button onClick={onClose}
              style={{ width: '100%', padding: '13px', borderRadius: 14, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 14 }}>
              Back to InCynq →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay}>
      <div style={card} className="fadeUp">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="sg" style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Quick survey</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {step + 1} of {TOTAL_STEPS} · Earn 10 L$ on completion
            </div>
          </div>
          <button onClick={handleDismiss}
            style={{ color: C.muted, fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.border, borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.sky}, ${C.peach})`, borderRadius: 4, transition: 'width .3s' }} />
        </div>

        {/* Reminder note */}
        <div style={{ padding: '8px 12px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 10, marginBottom: 20, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          💡 This comes back every 28 days until completed — it only takes 30 seconds.
        </div>

        {/* ── Q1: Satisfaction ── */}
        {step === 0 && (
          <div>
            <div style={qTitle}>How do you feel about InCynq?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              {SATISFACTION_EMOJIS.map(opt => (
                <button key={opt.value} onClick={() => setQ1(opt.value)}
                  style={{
                    flex: 1, padding: '16px 4px', borderRadius: 14, textAlign: 'center',
                    border: `2px solid ${q1 === opt.value ? C.sky : C.border}`,
                    background: q1 === opt.value ? `${C.sky}18` : C.card2,
                    transition: 'all .2s',
                  }}>
                  <div style={{ fontSize: 30 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 10, color: q1 === opt.value ? C.sky : C.muted, fontWeight: 700, marginTop: 6 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Q2: Usage ── */}
        {step === 1 && (
          <div>
            <div style={qTitle}>How often do you use InCynq?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {USAGE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setQ2(opt)}
                  style={choiceBtn(q2 === opt)}>
                  {opt}
                  {q2 === opt && <span style={{ color: C.sky, marginLeft: 'auto' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Q3: Content relevance ── */}
        {step === 2 && (
          <div>
            <div style={qTitle}>Is the content in your feed relevant to your SL interests?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {RELEVANCE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setQ3(opt)}
                  style={choiceBtn(q3 === opt)}>
                  {opt}
                  {q3 === opt && <span style={{ color: C.sky, marginLeft: 'auto' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Q4: Interest groups ── */}
        {step === 3 && (
          <div>
            <div style={qTitle}>Which interest groups do you follow? <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}>(optional)</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 16 }}>
              We've pre-selected your current groups. Feel free to adjust.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { id: 'social', label: '👥 Social' },
                { id: 'fashion', label: '👗 Fashion' },
                { id: 'home', label: '🏡 Home & Living' },
                { id: 'shopping', label: '🛍 Shopping' },
                { id: 'roleplay', label: '🎭 Roleplay' },
                { id: 'entertainment', label: '🎶 Entertainment' },
                { id: 'creativity', label: '🎨 Creativity' },
                { id: 'creators', label: '⚙️ Creators' },
                { id: 'business', label: '💼 Business' },
                { id: 'breedables', label: '🐾 Breedables' },
                { id: 'vehicles', label: '🚗 Vehicles' },
                { id: 'lifestyle', label: '💞 Lifestyle' },
              ].map(g => {
                const sel = q4.includes(g.id);
                return (
                  <button key={g.id}
                    onClick={() => setQ4(prev => sel ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                    style={{
                      padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${sel ? C.sky : C.border}`,
                      background: sel ? `${C.sky}22` : C.card2,
                      color: sel ? C.sky : C.sub,
                      transition: 'all .15s',
                    }}>
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Q5: Free text ── */}
        {step === 4 && (
          <div>
            <div style={qTitle}>Any feedback for us? <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}>(optional)</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 16 }}>
              What's working? What could be better? We read every response.
            </div>
            <textarea
              value={q5}
              onChange={e => setQ5(e.target.value)}
              placeholder="Your honest thoughts…"
              className="inp"
              style={{ minHeight: 120, resize: 'none', lineHeight: 1.6 }}
              maxLength={500}
            />
            <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 }}>{q5.length}/500</div>
          </div>
        )}

        {/* ── Q6: Star rating ── */}
        {step === 5 && (
          <div>
            <div style={qTitle}>If you had to give InCynq a star rating, what would you give?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setQ6(star)}
                  style={{
                    fontSize: 44,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: q6 !== null && star > q6 ? 0.3 : 1,
                    transition: 'opacity .15s, transform .15s',
                    transform: q6 !== null && star <= q6 ? 'scale(1.15)' : 'scale(1)',
                  }}>
                  {q6 !== null && star <= q6 ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {q6 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: C.sky, fontWeight: 700, marginTop: 4 }}>
                {['', 'Very unhappy 😞', 'Needs work 😕', 'Getting there 🙂', 'Really good 😊', 'Love it! 🤩'][q6]}
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex: '0 0 70px', padding: '12px', borderRadius: 14, background: C.card2, border: `1px solid ${C.border}`, color: C.sub, fontWeight: 700, fontSize: 13 }}>
              ←
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext() || submitting}
            style={{
              flex: 1, padding: '13px', borderRadius: 14, fontWeight: 900, fontSize: 14,
              background: canNext() && !submitting ? `linear-gradient(135deg,${C.sky},${C.peach})` : C.border,
              color: canNext() && !submitting ? '#060d14' : C.muted,
              transition: 'all .2s',
            }}>
            {submitting ? '⏳ Submitting…' : step === TOTAL_STEPS - 1 ? 'Submit & claim 10 L$ →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.8)',
  zIndex: 900,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
};

const card = {
  background: '#071820',
  border: '1px solid #0f3848',
  borderRadius: 24,
  padding: 24,
  width: '100%',
  maxWidth: 460,
  maxHeight: '92vh',
  overflowY: 'auto',
};

const qTitle = {
  fontSize: 17,
  fontWeight: 800,
  color: '#f0f9ff',
  lineHeight: 1.4,
};

const choiceBtn = (selected) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '14px 16px',
  borderRadius: 12,
  textAlign: 'left',
  fontSize: 14,
  fontWeight: 600,
  border: `1.5px solid ${selected ? '#00b4c8' : '#0f3848'}`,
  background: selected ? 'rgba(0,180,200,0.12)' : 'rgba(10,32,48,1)',
  color: selected ? '#00b4c8' : '#8cc4d0',
  transition: 'all .15s',
  cursor: 'pointer',
});
