import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import {
  getDashboardTier,
  getDashboardSubscription,
  upgradeDashboard,
  getBasicBrandStats,
  getSimpleViewTrend,
  getTopPosts,
  getExtendedBrandStats,
  getPeakViewingHours,
} from '../lib/db';

export default function DashboardScreen({ onClose }) {
  const { currentUser, toast } = useApp();
  const [tier, setTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [upgraded, setUpgraded] = useState(null);
  const [peakData, setPeakData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Brand accounts AND official account can access this screen
  const isBrand = currentUser?.accountType === 'brand';
  const isOfficialAccount = currentUser?.accountType === 'official';
  const canAccess = isBrand || isOfficialAccount;

  const loadAll = async () => {
    if (!currentUser?.id || !canAccess) return;
    setLoading(true);
    try {
      const [tierData, basicStats, trendData, topData, subData] = await Promise.all([
        getDashboardTier(currentUser.id),
        getBasicBrandStats(currentUser.id),
        getSimpleViewTrend(currentUser.id),
        getTopPosts(currentUser.id, 3),
        getDashboardSubscription(currentUser.id),
      ]);
      setTier(tierData);
      setStats(basicStats);
      setTrend(trendData);
      setTopPosts(topData);
      setSubscription(subData);

      if (tierData?.tier === 'upgraded') {
        const [ext, peak] = await Promise.all([
          getExtendedBrandStats(currentUser.id, 90),
          getPeakViewingHours(currentUser.id, 30),
        ]);
        setUpgraded(ext);
        setPeakData(peak);
      }
    } catch (e) {
      console.warn('Dashboard load failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [currentUser?.id]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await upgradeDashboard(currentUser.id);
      if (res.success) {
        toast('✅ Dashboard upgraded! Enjoy deeper insights.', 'sky');
        setShowUpgradeModal(false);
        await loadAll();
      } else {
        if (res.error?.includes('Insufficient')) {
          toast(`💰 You need ${res.shortfall} more L$ in your wallet`, 'peach');
        } else {
          toast(`⚠️ ${res.error}`, 'peach');
        }
      }
    } catch (e) {
      toast('⚠️ Upgrade failed — try again', 'peach');
    } finally {
      setUpgrading(false);
    }
  };

  // Non-brand, non-official users get blocked
  if (!canAccess) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
          <button onClick={onClose} style={{ color: C.text, fontSize: 22 }}>←</button>
          <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Dashboard</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 48 }}>🏢</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: C.text }}>Dashboard is for brands</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Upgrade your account to a brand to see your post analytics, follower insights, and more.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading your dashboard…</div>
      </div>
    );
  }

  const isUpgraded = tier?.tier === 'upgraded';
  const isOfficial = tier?.is_official === true;
  const isGrace = tier?.status === 'grace';
  const daysLeft = tier?.days_until_renewal;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', overflowY: 'auto' }} className="fadeUp">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300 }}>←</button>
        <div style={{ flex: 1 }}>
          <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Dashboard</span>
          {isOfficial && (
            <span style={{ marginLeft: 8, fontSize: 10, background: `${C.sky}22`, color: C.sky, border: `1px solid ${C.sky}44`, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>
              ⚡ Official
            </span>
          )}
          {!isOfficial && isUpgraded && (
            <span style={{ marginLeft: 8, fontSize: 10, background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}44`, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>
              💎 Upgraded
            </span>
          )}
        </div>
      </div>

      {/* Grace period banner (hide for official accounts) */}
      {isGrace && !isOfficial && (
        <div style={{ padding: '12px 16px', background: '#ff8c0011', borderBottom: '1px solid #ff8c0033', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#ff8c00' }}>Upgrade in grace period</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
              Top up your wallet to keep your upgrade active.
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '16px', paddingBottom: 40 }}>

        {/* Welcome summary */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, letterSpacing: 0.5 }}>LAST 30 DAYS</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginTop: 4 }}>
            {stats?.total_views?.toLocaleString() || 0} views
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            across {stats?.post_count || 0} {stats?.post_count === 1 ? 'post' : 'posts'}
          </div>
        </div>

        {/* Core stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard label="Impressions" value={stats?.total_impressions} icon="👁️" />
          <StatCard label="Unique viewers" value={stats?.unique_viewers} icon="👥" />
          <StatCard label="Profile visits" value={stats?.profile_views} icon="🔍" />
          <StatCard label="Followers" value={stats?.followers} subValue={`+${stats?.new_followers || 0} new`} icon="⭐" />
        </div>

        {/* View trend chart (7 days) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📈 Views — last 7 days</div>
          <TrendChart data={trend} />
        </div>

        {/* Top posts */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            🏆 {isUpgraded ? 'All posts ranked' : 'Top 3 posts'}
          </div>
          {topPosts.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: '20px 0', textAlign: 'center' }}>
              No posts yet — create your first one!
            </div>
          ) : (
            topPosts.map((p, i) => (
              <div key={p.post_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < topPosts.length - 1 ? `1px solid ${C.border}22` : 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.sky, minWidth: 22 }}>#{i + 1}</div>
                {p.posts?.image_url && (
                  <img src={p.posts.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {p.posts?.caption || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {p.total_views} views · {p.unique_viewers} unique
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ═══ UPGRADED TIER SECTIONS ═══ */}
        {isUpgraded && upgraded && (
          <>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>
              💎 UPGRADED INSIGHTS
            </div>

            {/* Engagement metrics */}
            <div style={{ background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>🎯 Engagement (90 days)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MetricBlock label="View-through rate" value={`${upgraded.avg_vtr}%`} hint="% of impressions → views" />
                <MetricBlock label="Engagement rate" value={`${upgraded.engagement_rate}%`} hint="Likes + comments / views" />
                <MetricBlock label="Total likes" value={upgraded.total_likes?.toLocaleString()} />
                <MetricBlock label="Total comments" value={upgraded.total_comments?.toLocaleString()} />
              </div>
            </div>

            {/* Peak timing */}
            {peakData && (
              <div style={{ background: C.card, border: `1px solid ${C.gold}22`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>⏰ Best time to post</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.muted }}>Peak hour</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                      {peakData.peak_hour}:00
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.muted }}>Peak day</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                      {peakData.peak_day}
                    </div>
                  </div>
                </div>
                {/* Day of week mini bars */}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {peakData.day_breakdown.map((d, i) => {
                    const max = Math.max(...peakData.day_breakdown.map(x => x.count), 1);
                    const height = (d.count / max) * 40;
                    return (
                      <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                          <div style={{ width: '100%', height: `${height}px`, background: C.sky, borderRadius: 2, opacity: d.count > 0 ? 1 : 0.2 }} />
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>{d.day}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subscription details — hidden for official accounts */}
            {subscription && !isOfficial && (
              <div style={{ background: `${C.gold}0a`, border: `1px solid ${C.gold}33`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8 }}>💎 Your upgrade</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                  <div><strong style={{ color: C.text }}>500 L$/month</strong> · next renewal in <strong style={{ color: C.text }}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</strong></div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    Auto-renews from your wallet. Keep your wallet topped up to avoid interruptions.
                  </div>
                </div>
              </div>
            )}

            {/* Official account notice */}
            {isOfficial && (
              <div style={{ background: `${C.sky}0a`, border: `1px solid ${C.sky}33`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.sky, marginBottom: 6 }}>⚡ Official account</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                  InCynq has permanent full access to the dashboard. No billing, no renewals.
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ FREE TIER → UPGRADE CTA ═══ */}
        {!isUpgraded && (
          <div style={{ background: `linear-gradient(135deg, ${C.gold}11, ${C.peach}11)`, border: `1px solid ${C.gold}44`, borderRadius: 16, padding: 18, marginTop: 10 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>💎</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>
              Want to see more?
            </div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
              Upgrade your dashboard for deeper insights — peak viewing hours, engagement rates, audience behaviour, and your best-performing content.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Perk icon="🎯" text="Engagement & view-through rates" />
              <Perk icon="⏰" text="Peak viewing hours & best days" />
              <Perk icon="📊" text="90-day trend data" />
              <Perk icon="🏆" text="All posts ranked (not just top 3)" />
              <Perk icon="👥" text="Audience insights" />
            </div>
            <button onClick={() => setShowUpgradeModal(true)}
              style={{ width: '100%', padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 13, border: 'none' }}>
              Upgrade for 500 L$/month →
            </button>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => !upgrading && setShowUpgradeModal(false)}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24 }}
            className="fadeUp" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>💎</div>
            <div className="sg" style={{ fontWeight: 800, fontSize: 18, color: C.text, textAlign: 'center', marginBottom: 8 }}>
              Upgrade Dashboard
            </div>
            <div style={{ fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
              500 L$/month from your wallet. Auto-renews. You'll get a 7-day heads-up each cycle.
            </div>

            {/* Wallet check */}
            <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted }}>Your wallet</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                    {(currentUser.wallet || 0).toLocaleString()} L$
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Today's charge</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.gold }}>500 L$</div>
                </div>
              </div>
              {currentUser.wallet < 500 && (
                <div style={{ marginTop: 10, padding: 10, background: '#ff446611', border: '1px solid #ff446633', borderRadius: 8, fontSize: 11, color: '#ff4466' }}>
                  ⚠️ Not enough L$ — top up {500 - (currentUser.wallet || 0)} more to continue
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => !upgrading && setShowUpgradeModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleUpgrade} disabled={upgrading || (currentUser.wallet || 0) < 500}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: (currentUser.wallet || 0) < 500 ? C.card2 : `linear-gradient(135deg, ${C.gold}, ${C.peach})`,
                  color: (currentUser.wallet || 0) < 500 ? C.muted : '#060d14',
                  fontWeight: 800, fontSize: 13, border: 'none',
                  opacity: upgrading ? 0.6 : 1,
                }}>
                {upgrading ? '⏳ Processing…' : 'Confirm 500 L$'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              L$ is non-refundable. Cancel anytime — your upgrade runs until the end of the current cycle.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helper sub-components
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, subValue, icon }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{value?.toLocaleString() || 0}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
      {subValue && <div style={{ fontSize: 10, color: C.sky, fontWeight: 700, marginTop: 2 }}>{subValue}</div>}
    </div>
  );
}

function MetricBlock({ label, value, hint }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

function Perk({ icon, text }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.sub }}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ fontSize: 12, color: C.muted, padding: '20px 0', textAlign: 'center' }}>No data yet</div>;
  }
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
      {data.map((d, i) => {
        const height = (d.count / max) * 60;
        const label = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{d.count}</div>
            <div style={{
              width: '100%', height: `${Math.max(height, 2)}px`,
              background: `linear-gradient(180deg, ${C.sky}, ${C.sky}88)`,
              borderRadius: '4px 4px 0 0',
              opacity: d.count > 0 ? 1 : 0.2,
            }} />
            <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
