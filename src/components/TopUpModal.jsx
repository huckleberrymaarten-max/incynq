import { useState, useEffect, useRef } from 'react';
import C from '../theme';
import { supabase } from '../lib/supabase';
import { createPaymentIntent, refreshProfile } from '../lib/db';

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

// Format remaining time (e.g. "14m 23s")
const formatTimeLeft = (expiresAt) => {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return 'expired';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function TopUpModal({ currentUser, onClose, onWalletUpdated }) {
  const [step, setStep] = useState('amount');     // 'amount' | 'code' | 'success'
  const [amount, setAmount] = useState(null);     // selected amount in L$
  const [customInput, setCustomInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [newBalance, setNewBalance] = useState(null);

  const initialWalletRef = useRef(currentUser.wallet || 0);
  const channelRef = useRef(null);

  // ── Generate code ──
  const handleGenerateCode = async (chosenAmount) => {
    setGenerating(true);
    setError(null);
    try {
      const result = await createPaymentIntent(currentUser.id, chosenAmount);
      setCode(result.code);
      setExpiresAt(result.expires_at);
      setAmount(result.amount);
      setStep('code');
    } catch (e) {
      console.error('Top up code generation failed:', e);
      setError(e.message || 'Could not generate code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Handle preset click ──
  const handlePresetClick = (preset) => {
    setAmount(preset);
    handleGenerateCode(preset);
  };

  // ── Handle custom amount submit ──
  const handleCustomSubmit = () => {
    const n = parseInt(customInput, 10);
    if (!n || n < 1) {
      setError('Please enter a valid amount (1 L$ or more)');
      return;
    }
    if (n > 100000) {
      setError('Max single top-up is 100,000 L$');
      return;
    }
    handleGenerateCode(n);
  };

  // ── Copy code to clipboard ──
  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // ── Subscribe to wallet changes once code is generated ──
  useEffect(() => {
    if (step !== 'code' || !currentUser.id) return;

    // Real-time subscription to profile changes
    const channel = supabase
      .channel(`wallet:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newWallet = payload.new?.wallet;
          if (newWallet != null && newWallet > initialWalletRef.current) {
            setNewBalance(newWallet);
            setStep('success');
            if (onWalletUpdated) onWalletUpdated(newWallet);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Polling fallback every 5s
    const poll = setInterval(async () => {
      const profile = await refreshProfile(currentUser.id);
      if (profile && profile.wallet > initialWalletRef.current) {
        setNewBalance(profile.wallet);
        setStep('success');
        if (onWalletUpdated) onWalletUpdated(profile.wallet);
      }
    }, 5000);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      clearInterval(poll);
    };
  }, [step, currentUser.id, onWalletUpdated]);

  // ── Countdown ticker ──
  useEffect(() => {
    if (!expiresAt || step !== 'code') return;
    const update = () => setTimeLeft(formatTimeLeft(expiresAt));
    update();
    const tick = setInterval(update, 1000);
    return () => clearInterval(tick);
  }, [expiresAt, step]);

  // ── Generate new code (e.g. after expiry) ──
  const handleNewCode = () => {
    setStep('amount');
    setCode(null);
    setExpiresAt(null);
    setAmount(null);
    setError(null);
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 1000,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg, borderRadius: 20, padding: 24,
          width: '100%', maxWidth: 420, border: `1px solid ${C.border}`,
          maxHeight: '90vh', overflowY: 'auto',
        }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="sg" style={{ fontWeight: 800, fontSize: 20, color: C.text }}>
            💰 Top Up Wallet
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* ── STEP 1: AMOUNT SELECTION ── */}
        {step === 'amount' && (
          <>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 18, lineHeight: 1.6 }}>
              How much would you like to add to your wallet?
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {PRESET_AMOUNTS.map((preset) => (
                <button key={preset} onClick={() => handlePresetClick(preset)}
                  disabled={generating}
                  style={{
                    padding: '14px 8px', borderRadius: 12,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontWeight: 800, fontSize: 14,
                    cursor: generating ? 'wait' : 'pointer',
                    transition: 'all .2s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!generating) {
                      e.currentTarget.style.borderColor = C.gold;
                      e.currentTarget.style.color = C.gold;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.color = C.text;
                  }}>
                  {preset.toLocaleString()} L$
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 700, letterSpacing: 0.5 }}>
              OR ENTER CUSTOM AMOUNT
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="number" inputMode="numeric" min="1" max="100000"
                value={customInput}
                onChange={(e) => { setCustomInput(e.target.value); setError(null); }}
                placeholder="Amount in L$"
                disabled={generating}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12,
                  background: C.card, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 15, outline: 'none',
                }} />
              <button onClick={handleCustomSubmit} disabled={generating || !customInput}
                style={{
                  padding: '12px 18px', borderRadius: 12,
                  background: customInput && !generating ? `linear-gradient(135deg,${C.gold},${C.peach})` : C.border,
                  color: customInput && !generating ? '#060d14' : C.muted,
                  fontWeight: 800, fontSize: 14,
                  cursor: customInput && !generating ? 'pointer' : 'not-allowed',
                  border: 'none',
                }}>
                {generating ? '⏳' : 'Get Code'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 12px', background: `${C.peach}11`, border: `1px solid ${C.peach}44`, borderRadius: 10, fontSize: 13, color: C.peach, marginBottom: 12 }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ padding: '10px 14px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 12, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              💡 You'll get a code to enter at any InCynq ATM inworld. Pay there, and your wallet updates instantly.
            </div>
          </>
        )}

        {/* ── STEP 2: CODE DISPLAY ── */}
        {step === 'code' && (
          <>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 8, textAlign: 'center', lineHeight: 1.6 }}>
              ✓ Code generated for <strong style={{ color: C.gold }}>{amount.toLocaleString()} L$</strong>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 16, textAlign: 'center', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>YOUR PAYMENT CODE</div>
              <button onClick={handleCopyCode}
                style={{
                  width: '100%',
                  padding: '14px 12px',
                  borderRadius: 12,
                  background: C.card2,
                  border: `2px dashed ${C.gold}66`,
                  color: C.gold,
                  fontWeight: 900,
                  fontSize: 26,
                  letterSpacing: 4,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}>
                {code}
              </button>
              <div style={{ fontSize: 11, color: copied ? C.gold : C.muted, transition: 'color .2s' }}>
                {copied ? '✓ Copied to clipboard' : 'Tap to copy'}
                {timeLeft && !copied && <span style={{ color: C.muted }}> · expires in {timeLeft}</span>}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>HOW TO COMPLETE</div>
              {[
                ['1', `Walk inworld to any InCynq ATM`],
                ['2', `Touch the ATM and enter this code`],
                ['3', `Right-click the ATM → Pay ${amount.toLocaleString()} L$`],
              ].map(([n, text]) => (
                <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ minWidth: 22, height: 22, borderRadius: 7, background: `${C.gold}22`, color: C.gold, fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{text}</div>
                </div>
              ))}
            </div>

            {/* Waiting indicator */}
            <div style={{ padding: '12px 14px', background: `${C.gold}0a`, border: `1px solid ${C.gold}22`, borderRadius: 12, marginBottom: 16, fontSize: 12, color: C.muted, lineHeight: 1.6, textAlign: 'center' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.gold, marginRight: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              Waiting for payment at the ATM…
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleNewCode}
                style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                New Code
              </button>
              <button onClick={onClose}
                style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: SUCCESS ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.gold}, ${C.peach})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 36,
              boxShadow: `0 0 40px ${C.gold}44`,
            }}>✅</div>
            <div className="sg" style={{ fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 8 }}>
              Payment received!
            </div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 18 }}>
              <strong style={{ color: C.gold }}>+{amount.toLocaleString()} L$</strong> added to your wallet.
            </div>
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.gold}33`, marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>NEW BALANCE</div>
              <div className="sg" style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>
                L$ {(newBalance || 0).toLocaleString()}
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: '100%', padding: '13px', borderRadius: 14, background: `linear-gradient(135deg, ${C.gold}, ${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 14, cursor: 'pointer', border: 'none' }}>
              Done
            </button>
          </div>
        )}

        {/* Pulse keyframes */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.3); }
          }
        `}</style>
      </div>
    </div>
  );
}
