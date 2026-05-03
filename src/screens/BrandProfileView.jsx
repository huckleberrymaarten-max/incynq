import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { getProfileStats, formatMemberSince, getFoundingBrandBadge } from '../lib/db';
import DashboardScreen from './DashboardScreen';
import TopUpModal from '../components/TopUpModal';
import BrandSettingsPanel from '../components/BrandSettingsPanel';

export default function BrandProfileView({ onOpenUserProfile }) {
  const { currentUser, setCurrentUser } = useApp();

  // If managing another brand, show that brand's info
  const activeBrand = currentUser.managingBrandId
    ? (currentUser.managedBrands || []).find(b => b.id === currentUser.managingBrandId)
    : null;

  const brandName        = activeBrand?.brand_name        || currentUser.brandName;
  const brandLogoUrl     = activeBrand?.brand_logo_url    || currentUser.brandLogoUrl;
  const brandDescription = activeBrand?.brand_description || currentUser.brandDescription;
  const brandWallet      = activeBrand?.brand_wallet      ?? currentUser.brandWallet ?? 0;
  const brandActivatedAt = currentUser.brandActivatedAt;
  const isManager        = !!currentUser.managingBrandId;

  const [stats,         setStats]         = useState({ posts: 0, followers: 0 });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTopUp, setShowTopUp]         = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [resigning, setResigning] = useState(false);

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

  const isFoundingBrand = currentUser.accountType === 'brand' && isManager ? null : currentUser.foundingBrandNumber;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Profile</span>
        {!isManager && <button onClick={() => setShowSettings(true)} style={{ fontSize: 20 }}>⚙️</button>}
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
              {brandLogoUrl
                ? <img src={brandLogoUrl} alt="brand" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '🏷️'
              }
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{brandName}</div>

            {/* Brand since */}
            {brandActivatedAt && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📅</span>
                <span>{formatMemberSince(brandActivatedAt, 'brand')}</span>
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
                {getFoundingBrandBadge(isManager ? null : currentUser.foundingBrandNumber)}
              </div>
            )}
          </div>
        </div>

        {/* Brand description */}
        {brandDescription && (
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
            {brandDescription}
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
              L$ {(brandWallet).toLocaleString()}
            </div>
          </div>
          <button onClick={() => setShowTopUp(true)} style={{ background: 'rgba(244,185,66,0.12)', border: '1px solid rgba(244,185,66,0.3)', borderRadius: 20, padding: '7px 16px', color: '#F4B942', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Top Up via ATM
          </button>
        </div>

        {/* Edit Brand Profile button (owner only) / Resign button (manager only) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {isManager
            ? (
              <button onClick={() => setShowResignConfirm(true)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: '#ff446611', border: '1px solid #ff446633', color: '#ff6644', fontWeight: 700, fontSize: 13 }}>
                🚪 Resign as manager
              </button>
            ) : (
              <button onClick={() => setShowSettings(true)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13 }}>
                Edit Brand Profile
              </button>
            )
          }
        </div>

      </div>

      {/* Resign confirmation sheet */}
      {showResignConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowResignConfirm(false)}>
          <div style={{ background: '#0d1f2d', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 32px' }}
            onClick={e => e.stopPropagation()} className="fadeUp">
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🚪</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', textAlign: 'center', marginBottom: 8 }}>Resign as manager?</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.7, marginBottom: 24 }}>
              You'll lose access to post and place ads as <strong style={{ color: '#fff' }}>{brandName}</strong>. The brand owner will be notified.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowResignConfirm(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14 }}>
                Cancel
              </button>
              <button
                disabled={resigning}
                onClick={async () => {
                  setResigning(true);
                  try {
                    const { resignAsManager } = await import('../lib/db');
                    await resignAsManager(currentUser.managingBrandId, currentUser.id);
                    // Remove from managedBrands and switch back to resident mode
                    setCurrentUser(u => ({
                      ...u,
                      brandMode: false,
                      managingBrandId: null,
                      managedBrands: (u.managedBrands || []).filter(b => b.id !== currentUser.managingBrandId),
                    }));
                    setShowResignConfirm(false);
                  } catch (e) {
                    console.warn('Resign failed:', e.message);
                  } finally {
                    setResigning(false);
                  }
                }}
                style={{ flex: 1, padding: '13px', borderRadius: 14, background: resigning ? '#ff446644' : '#ff4466', color: '#fff', fontWeight: 800, fontSize: 14, opacity: resigning ? 0.7 : 1 }}>
                {resigning ? 'Resigning…' : 'Yes, resign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopUp    && (
        <TopUpModal
          currentUser={{ ...currentUser, wallet: brandWallet }}
          onClose={() => setShowTopUp(false)}
          onWalletUpdated={(newBalance) => setCurrentUser(u => ({ ...u, brandWallet: newBalance }))}
        />
      )}
      {showDashboard && <DashboardScreen onClose={() => setShowDashboard(false)} />}
      {showSettings  && <BrandSettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
