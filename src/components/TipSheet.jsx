import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { submitTip, getTipLadder, getTippableBalance } from '../lib/db';

// ── Tip sheet ─────────────────────────────────────────────────
// Opened from the live event card and from the now-playing bar, so someone
// listening while browsing the feed can tip without navigating back.
//
// Two refusals matter here and they are NOT the same thing:
//   · not enough money  → "top up at an ATM"
//   · enough money, but it's all welcome credit → say THAT, because telling
//     someone with 100 L$ sitting there that they have "not enough" is a lie.
// submit_tip flags the second case, and this reads it.
export default function TipSheet({ session, onClose }) {
  const { currentUser, toast } = useApp();

  const [ladder,   setLadder]   = useState([10, 25, 50, 75, 100]);
  const [amount,   setAmount]   = useState(null);
  const [custom,   setCustom]   = useState('');
  const [message,  setMessage]  = useState('');
  const [tippable, setTippable] = useState(null);
  const [sending,  setSending]  = useState(false);
  const [promoOnly, setPromoOnly] = useState(false);

  useEffect(() => {
    getTipLadder().then(setLadder).catch(() => {});
    if (currentUser?.id) {
      getTippableBalance(currentUser.id).then(setTippable).catch(() => setTippable(0));
    }
  }, [currentUser?.id]);

  const value = custom ? parseInt(custom, 10) : amount;
  const valid = Number.isFinite(value) && value > 0;
  const afford = tippable === null || !valid || value <= tippable;

  const send = async () => {
    if (!valid) { toast('Pick an amount first', 'error'); return; }
    setSending(true);
    try {
      const res = await submitTip(session.sessionId, value, message.trim() || null);
      toast(`${value} L$ sent — thanks for backing the artist!`);
      setTippable(res.new_balance != null
        ? Math.max(0, res.new_balance - (currentUser?.promoBalance || 0))
        : (tippable ?? 0) - value);
      onClose && onClose();
    } catch (e) {
      if (e.promoOnly) {
        setPromoOnly(true);
        setTippable(e.tippable ?? 0);
      }
      toast(e.message || 'Could not send that tip', 'error');
    } finally { setSending(false); }
  };

  const pick = (n) => { setCustom(''); setAmount(n); setPromoOnly(false); };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,15,20,0.88)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '20px 18px calc(24px + env(safe-area-inset-bottom))', border: `1px solid ${C.border}` }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>💰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>Tip {session?.who || 'the artist'}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{session?.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
          {tippable === null ? '\u00a0' : `You have ${tippable.toLocaleString()} L$ to tip with`}
        </div>

        {/* Ladder */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {ladder.map(n => {
            const on = !custom && amount === n;
            const tooMuch = tippable !== null && n > tippable;
            return (
              <button key={n} onClick={() => pick(n)} disabled={tooMuch}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 800,
                  border: `1.5px solid ${on ? C.sky : C.border}`,
                  background: on ? `${C.sky}18` : 'transparent',
                  color: tooMuch ? C.border : on ? C.sky : C.sub,
                  cursor: tooMuch ? 'default' : 'pointer' }}>
                {n}
              </button>
            );
          })}
        </div>

        <input
          type="number" min="1" placeholder="Other amount"
          value={custom}
          onChange={e => { setCustom(e.target.value); setAmount(null); setPromoOnly(false); }}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, marginBottom: 10,
            border: `1px solid ${custom ? C.sky : C.border}`, background: C.card2,
            color: C.text, fontSize: 14, boxSizing: 'border-box' }} />

        <input
          placeholder="Say something (optional)"
          value={message} maxLength={140}
          onChange={e => setMessage(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, marginBottom: 14,
            border: `1px solid ${C.border}`, background: C.card2,
            color: C.text, fontSize: 13, boxSizing: 'border-box' }} />

        {/* The welcome-credit case, explained rather than refused blankly */}
        {promoOnly && (
          <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 12, padding: '11px 13px', marginBottom: 14, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
            Your welcome credit is for exploring InCynq — top up at any InCynq ATM inworld
            and you can send tips from that.
          </div>
        )}

        <button onClick={send} disabled={sending || !valid || !afford}
          style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none',
            background: (sending || !valid || !afford) ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`,
            color: (sending || !valid || !afford) ? C.muted : '#060d14',
            fontWeight: 900, fontSize: 14, cursor: (sending || !valid || !afford) ? 'default' : 'pointer' }}>
          {sending ? 'Sending…'
            : !valid ? 'Pick an amount'
            : !afford ? 'More than you have'
            : `Send ${value} L$`}
        </button>

        <div style={{ fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Goes straight to the artist, paid out to their avatar a week after the gig.
          Tips are not refundable.
        </div>
      </div>
    </div>
  );
}
