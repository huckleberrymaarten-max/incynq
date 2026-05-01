import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { getProfileStats, formatMemberSince, getFoundingBrandBadge } from '../lib/db';
import DashboardScreen from './DashboardScreen';
import BrandSettingsPanel from '../components/BrandSettingsPanel';

export default function BrandProfileView({ onOpenUserProfile }) {
  const { currentUser, setCurrentUser } = useApp();

  const [stats,         setStats]         = useState({ posts: 0, followers: 0 });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const s = await getProfileStats(currentUser.id);
        setStats({ posts: s.posts || 0, followers: s.followers || 0 });
      } catch (e) {
        console.warn('Brand stats failed:', e.message);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [currentUser.id]);

  const isFoundingBrand = currentUser.accountType === 'brand' && currentUser.foundingBrandNumber;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Profile</span>
        <button onClick={() => setShowSettings(true)} style={{ fontSize: 20 }}>⚙️</button>
      </div>

      <div style={{ padding: '20px 16px 80px' }}>

        {/* Brand logo + name */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              overflow: 'hidden',
              background: 'rgba(0,180,200,0.12)',
              border: `2px solid rgba(0,180,200,0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>
              {currentUser.brandLogoUrl
                ? <img src={currentUser.brandLogoUrl} alt="brand" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '🏷️'
              }
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{currentUser.brandName}</div>

            {/* Brand since */}
            {currentUser.brandActivatedAt && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📅</span>
                <span>{formatMemberSince(currentUser.brandActivatedAt, 'brand')}</span>
              </div>
            )}

            {/* Founding Brand Badge */}
            {isFoundingBrand && (
              <div style={{
                marginTop: 6,
                display: 'inline-block',
                background: `linear-gradient(135deg, ${C.gold}22, ${C.peach}22)`,
                border: `1px solid ${C.gold}44`,
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: C.gold,
              }}>
                {getFoundingBrandBadge(currentUser.foundingBrandNumber)}
              </div>
            )}
          </div>
        </div>

        {/* Brand description */}
        {currentUser.brandDescription && (
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
            {currentUser.brandDescription}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 12 }}>
          {[['Posts', stats.posts], ['Followers', stats.followers]].map(([label, val], i, arr) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '12px 0',
              background: C.card2,
              borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>
                {statsLoading ? '–' : val}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Dashboard */}
        <button onClick={() => setShowDashboard(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: `linear-gradient(135deg, ${C.sky}22, ${C.sky}11)`, borderRadius: 14, border: `1px solid ${C.sky}44`, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.sky }}>Dashboard</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Views, impressions & insights</div>
            </div>
          </div>
          <span style={{ color: C.muted }}>→</span>
        </button>

        {/* Brand Wallet */}
        <div style={{ background: C.card2, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>BRAND WALLET</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#F4B942' }}>
              L$ {(currentUser.brandWallet || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 1.5 }}>
            Top up via<br />InCynq ATM
          </div>
        </div>

        {/* Edit Brand Profile button */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={() => setShowSettings(true)}
            style={{ flex: 1, padding: '10px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13 }}>
            Edit Brand Profile
          </button>
        </div>

      </div>

      {showDashboard && <DashboardScreen onClose={() => setShowDashboard(false)} />}
      {showSettings  && <BrandSettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
