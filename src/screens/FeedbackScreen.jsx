import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { submitReview, submitSuggestion, getUserReview } from '../lib/db';
import { useEffect } from 'react';
import C from '../theme';

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0 4px' }}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          style={{
            fontSize: 36, background: 'none', border: 'none', cursor: 'pointer',
            filter: (hover || value) >= n ? 'none' : 'grayscale(1) opacity(0.3)',
            transform: (hover || value) >= n ? 'scale(1.15)' : 'scale(1)',
            transition: 'all 0.1s',
          }}
        >⭐</button>
      ))}
    </div>
  );
}

const STAR_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent!' };

export default function FeedbackScreen({ onClose }) {
  const { currentUser } = useApp();
  const [tab, setTab]           = useState('review');
  const [rating, setRating]     = useState(0);
  const [body, setBody]         = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [sugDone, setSugDone]   = useState(false);
  const [existing, setExisting] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    getUserReview(currentUser.id).then(r => {
      setExisting(r);
      setLoadingExisting(false);
    }).catch(() => setLoadingExisting(false));
  }, [currentUser.id]);

  const handleSubmitReview = async () => {
    if (!rating) { setError('Please pick a star rating.'); return; }
    if (!body.trim()) { setError('Please write something about your experience.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await submitReview({ userId: currentUser.id, rating, body: body.trim() });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion.trim()) { setError('Please write your idea first.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await submitSuggestion({ userId: currentUser.id, body: suggestion.trim() });
      setSugDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="fadeUp"
        style={{
          background: '#0d1f2d', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480, padding: '20px 20px 32px',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
          {[
            { id: 'review', label: '⭐ Leave a Review' },
            { id: 'suggest', label: '💡 Suggest an Idea' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(''); }} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: tab === t.id ? 'rgba(0,180,200,0.18)' : 'transparent',
              color: tab === t.id ? C.sky : 'rgba(255,255,255,0.4)',
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 13, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Review tab ── */}
        {tab === 'review' && (
          loadingExisting ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '32px 0', fontSize: 14 }}>Loading…</div>
          ) : existing ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>You've already left a review</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                Your {existing.rating}-star review is live on incynq.net.
              </div>
              {existing.admin_reply && (
                <div style={{ background: 'rgba(0,180,200,0.08)', border: '1px solid rgba(0,180,200,0.2)', borderRadius: 12, padding: '12px 14px', textAlign: 'left', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sky, marginBottom: 4 }}>REPLY FROM INCYNQ</div>
                  <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{existing.admin_reply}</div>
                </div>
              )}
              <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'rgba(0,180,200,0.15)', color: C.sky, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Thanks for your review!</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 24 }}>
                Your review is live on incynq.net. Thanks for sharing!
              </div>
              <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.sky},${C.green})`, color: '#040f14', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
                How's your InCynq experience so far?
              </div>

              <StarPicker value={rating} onChange={setRating} />
              {rating > 0 && (
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 16 }}>
                  {STAR_LABELS[rating]}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Tell the community what you think of the InCynq app…"
                  maxLength={500}
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff', fontSize: 14, resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 }}>
                  {body.length}/500
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: '#ff6680', marginBottom: 12, textAlign: 'center' }}>{error}</div>
              )}

              <button
                onClick={handleSubmitReview}
                disabled={submitting || !rating || !body.trim()}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  background: rating && body.trim() ? `linear-gradient(135deg,${C.sky},${C.green})` : 'rgba(255,255,255,0.08)',
                  color: rating && body.trim() ? '#040f14' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 15, cursor: rating && body.trim() ? 'pointer' : 'default',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting…' : '⭐ Submit Review'}
              </button>
            </div>
          )
        )}

        {/* ── Suggest tab ── */}
        {tab === 'suggest' && (
          sugDone ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💡</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Idea received!</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 24 }}>
                We read every suggestion. Thanks for helping make InCynq better.
              </div>
              <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.sky},${C.green})`, color: '#040f14', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 4 }}>
                Got an idea or improvement?
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 20 }}>
                We'll read every one. Goes straight to the InCynq team.
              </div>

              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder="What would make InCynq even better for you?"
                  maxLength={1000}
                  rows={5}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff', fontSize: 14, resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 }}>
                  {suggestion.length}/1000
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: '#ff6680', marginBottom: 12, textAlign: 'center' }}>{error}</div>
              )}

              <button
                onClick={handleSubmitSuggestion}
                disabled={submitting || !suggestion.trim()}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  background: suggestion.trim() ? `linear-gradient(135deg,${C.gold},${C.sky})` : 'rgba(255,255,255,0.08)',
                  color: suggestion.trim() ? '#040f14' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 15, cursor: suggestion.trim() ? 'pointer' : 'default',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Sending…' : '💡 Send Idea'}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
