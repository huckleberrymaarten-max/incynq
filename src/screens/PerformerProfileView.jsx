import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { getProfileStats, formatMemberSince, getPerformerHours, buyBroadcastHours } from '../lib/db';

// Airtime quick-picks, in MINUTES (min 60, 30-min steps). Custom adds more.
const QUICK_MINUTES = [60, 90, 120];

// Fractional hours -> "10h 0m"
function fmtHours(h) {
  const totalMin = Math.round((Number(h) || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh && mm) return `${hh}h ${mm}m`;
  if (hh)       return `${hh}h`;
  return `${mm}m`;
}

const minLabel = (m) => (m % 60 === 0 ? `${m / 60} hr` : `${(m / 60).toFixed(1)} hr`);

export default function PerformerProfileView() {
  const { currentUser, setCurrentUser, toast } = useApp();
  const { appContent } = useContent();
  const rate = parseInt(appContent?.broadcast_hour_price || 175);

  const perf = (currentUser.ownedBrands || []).find(b => b.id === currentUser.activePerformerId);
  const performerId = perf?.id;

  const [stats,        setStats]        = useState({ posts: 0, followers: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [hoursBalance, setHoursBalance] = useState(0);
  const [spendWallet,  setSpendWallet]  = useState(perf?.brand_wallet || 0);
  const [loadingHours, setLoadingHours] = useState(true);
  const [selected,     setSelected]     = useState(60);   // minutes
  const [custom,       setCustom]       = useState('');
  const [buying,       setBuying]       = useState(false);

  const loadHours = async () => {
    if (!performerId) return;
    try {
      const h = await getPerformerHours(performerId);
      setHoursBalance(h.hoursBalance);
      setSpendWallet(h.spendWallet);
    } catch (e) { console.warn('Load hours failed:', e.message); }
    finally { setLoadingHours(false); }
  };

  useEffect(() => {
    if (!performerId) return;
    getProfileStats(performerId)
      .then(s => setStats({ posts: s.posts || 0, followers: s.followers || 0 }))
      .catch(e => console.warn('Performer stats failed:', e.message))
      .finally(() => setStatsLoading(false));
    loadHours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performerId]);

  const exit = () => setCurrentUser(u => ({ ...u, performerMode: false, activePerformerId: null }));

  // Safety: if no performer resolved, drop back to resident.
  if (!perf) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: C.muted, marginBottom: 16 }}>Performer not found.</div>
        <button onClick={exit} style={{ padding: '10px 20px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, cursor: 'pointer' }}>Back to profile</button>
      </div>
    );
  }

  const minutes      = custom ? parseInt(custom, 10) : selected;
  const validMinutes = Number.isFinite(minutes) && minutes >= 60 && minutes % 30 === 0;
  const cost         = validMinutes ? Math.round((minutes / 60) * rate) : 0;
  const canAfford    = cost <= spendWallet;

  const doBuy = async () => {
    if (!validMinutes) { toast('Pick at least 60 minutes, in 30-minute steps', 'error'); return; }
    if (!canAfford)    { toast('Not enough spend credit — top up first', 'error'); return; }
    setBuying(true);
    try {
      const res = await buyBroadcastHours(performerId, minutes);
      setHoursBalance(res.hours_balance);
      setSpendWallet(res.new_wallet);
      // keep local ownedBrands wallet in sync so re-entering shows the new balance
      setCurrentUser(u => ({
        ...u,
        ownedBrands: (u.ownedBrands || []).map(b => b.id === performerId ? { ...b, brand_wallet: res.new_wallet } : b),
      }));
      setCustom('');
      toast(`Added ${fmtHours(res.hours_added)} of airtime`);
    } catch (e) {
      toast(e.message || 'Could not buy hours', 'error');
    } finally { setBuying(false); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={exit} style={{ color: C.text, fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Performer</span>
      </div>

      <div style={{ padding: '20px 16px 80px' }}>

        {/* Logo + name */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, overflow: 'hidden', flexShrink: 0,
            background: 'rgba(0,180,200,0.12)', border: `2px solid rgba(0,180,200,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>
            {perf.brand_logo_url
              ? <img src={perf.brand_logo_url} alt="performer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '🎧'
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{perf.brand_name}</div>
            {perf.brand_handle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>@{perf.brand_handle}</div>}
            {perf.brand_activated_at && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🎵</span>
                <span>{formatMemberSince(perf.brand_activated_at, 'brand').replace('Brand', 'Performing')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 12 }}>
          {[['Posts', stats.posts], ['Followers', stats.followers]].map(([label, val], i, arr) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: C.card2, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{statsLoading ? '–' : val}</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Airtime */}
        <div style={{ background: C.card2, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>AIRTIME REMAINING</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.sky }}>{loadingHours ? '–' : fmtHours(hoursBalance)}</div>
            </div>
            <span style={{ fontSize: 26 }}>🔴</span>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5, marginBottom: 8 }}>BUY MORE (from spend wallet)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {QUICK_MINUTES.map(m => {
              const active = !custom && selected === m;
              return (
                <button key={m} onClick={() => { setCustom(''); setSelected(m); }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${active ? C.sky : C.border}`,
                    background: active ? 'rgba(0,180,200,0.12)' : 'transparent', color: active ? C.sky : C.muted,
                    fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                  {minLabel(m)}
                </button>
              );
            })}
            <input
              type="number" min="60" step="30" placeholder="Custom min"
              value={custom} onChange={e => setCustom(e.target.value)}
              style={{ width: 96, padding: '10px', borderRadius: 10, border: `1px solid ${custom ? C.sky : C.border}`,
                background: 'transparent', color: C.text, fontSize: 13, textAlign: 'center' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 12, color: validMinutes ? C.sub : C.muted }}>
              {validMinutes
                ? <>{minutes} min = <strong style={{ color: '#F4B942' }}>{cost.toLocaleString()} L$</strong></>
                : 'Min 60 min, in 30-min steps'}
            </div>
            <button onClick={doBuy} disabled={buying || !validMinutes}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none',
                background: (validMinutes && canAfford) ? `linear-gradient(135deg, ${C.sky}, ${C.peach})` : C.border,
                color: (validMinutes && canAfford) ? C.bg : C.muted, fontWeight: 800, fontSize: 13,
                cursor: (validMinutes && canAfford) ? 'pointer' : 'default', opacity: buying ? 0.7 : 1 }}>
              {buying ? 'Buying…' : canAfford ? 'Buy hours' : 'Low credit'}
            </button>
          </div>
        </div>

        {/* Spend wallet */}
        <div style={{ background: C.card2, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>SPEND WALLET</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#F4B942' }}>L$ {(spendWallet).toLocaleString()}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Non-refundable credit. Buys airtime and promotion. Your tip earnings are kept separate.</div>
        </div>

        {/* Back */}
        <button onClick={exit}
          style={{ width: '100%', padding: '11px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Back to my profile
        </button>
      </div>
    </div>
  );
}
