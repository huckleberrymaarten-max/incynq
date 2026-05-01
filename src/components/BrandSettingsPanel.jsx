import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { RemoveBrandModal } from './AccountLifecycleModals';
import BrandTeamScreen from '../screens/BrandTeamScreen';
import BrandProfileEditScreen from '../screens/BrandProfileEditScreen';

export default function BrandSettingsPanel({ onClose }) {
  const { currentUser, setCurrentUser, setLoggedIn, toast } = useApp();
  const [showBrandEdit,   setShowBrandEdit]   = useState(false);
  const [showBrandTeam,   setShowBrandTeam]   = useState(false);
  const [showRemoveBrand, setShowRemoveBrand] = useState(false);

  const handleCancelRemoval = async () => {
    try {
      const { cancelBrandRemoval } = await import('../lib/db');
      await cancelBrandRemoval(currentUser.id);
      setCurrentUser(u => ({ ...u, brandRemovalRequestedAt: null }));
      toast('Brand removal cancelled ✓');
    } catch (e) {
      toast('Could not cancel — try again', 'error');
    }
  };

  return (
    <>
      <div style={{
        position:      'fixed',
        inset:         0,
        background:    C.bg,
        zIndex:        700,
        display:       'flex',
        flexDirection: 'column',
        maxWidth:      480,
        margin:        '0 auto',
      }} className="fadeUp">

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0 }}>
          <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
          <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Settings</span>
          <span style={{ fontSize: 13, color: '#00B4C8', fontWeight: 600 }}>· {currentUser.brandName}</span>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 40 }}>

          {currentUser.brandRemovalRequestedAt && (
            <div style={{ background: '#7B1818', padding: '12px 20px', borderBottom: '1px solid #a82222' }}>
              <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
                ⚠️ <strong>{currentUser.brandName}</strong> is scheduled for removal in{' '}
                <strong>{Math.max(0, Math.ceil((new Date(currentUser.brandRemovalRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))} days</strong>.
              </div>
              <button onClick={handleCancelRemoval} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}>
                Cancel removal
              </button>
            </div>
          )}

          <div style={{ padding: '12px 20px 4px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>BRAND</div>

          <button onClick={() => { onClose(); setShowBrandEdit(true); }}
            style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div>✏️ Edit Brand Profile</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 400 }}>Logo, description and more</div>
            </div>
            <span style={{ color: C.muted }}>→</span>
          </button>

          <button onClick={() => { onClose(); setShowBrandTeam(true); }}
            style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div>👥 Brand Team</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 400 }}>Invite or manage your brand manager</div>
            </div>
            <span style={{ color: C.muted }}>→</span>
          </button>

          <div style={{ padding: '16px 20px 4px', marginTop: 8, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>BRAND WALLET</div>

          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}22` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Current balance</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F4B942' }}>{(currentUser.brandWallet || 0).toLocaleString()} L$</div>
              </div>
              <div style={{ background: 'rgba(244,185,66,0.1)', border: '1px solid rgba(244,185,66,0.25)', borderRadius: 8, padding: '6px 14px', color: '#F4B942', fontSize: 12, fontWeight: 700 }}>
                Top Up via ATM
              </div>
            </div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>Visit any InCynq ATM inworld to top up your Brand Wallet.</div>
          </div>

          <div style={{ padding: '12px 20px 4px', marginTop: 8, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>ACCOUNT ACTIONS</div>

          <button onClick={async () => { const { supabase } = await import('../lib/supabase'); await supabase.auth.signOut(); setLoggedIn(false); }}
            style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#ff4466', borderBottom: `1px solid ${C.border}22`, display: 'block' }}>
            🚪 Sign Out
          </button>

          <div style={{ padding: '16px 20px 6px', marginTop: 8, fontSize: 13, color: '#ff3333', fontWeight: 800, letterSpacing: 1 }}>⚠️ DANGER ZONE !</div>

          <button onClick={() => { onClose(); setShowRemoveBrand(true); }}
            style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#ff6b6b', borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div>🗑️ Remove Brand Account</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 400 }}>Remove your brand — resident account stays safe</div>
            </div>
            <span style={{ color: C.muted }}>→</span>
          </button>

          <div style={{ padding: '20px 20px 10px', fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
            InCynq · incynq.app<br />Not affiliated with Linden Lab or Second Life®
          </div>
        </div>
      </div>

      {showBrandEdit   && <BrandProfileEditScreen onClose={() => setShowBrandEdit(false)} />}
      {showBrandTeam   && <BrandTeamScreen        onClose={() => setShowBrandTeam(false)} />}
      {showRemoveBrand && (
        <RemoveBrandModal
          userId={currentUser.id}
          brandName={currentUser.brandName || 'your brand'}
          onClose={() => setShowRemoveBrand(false)}
          onConfirm={(brandRemovalRequestedAt) => {
            setCurrentUser(u => ({ ...u, brandRemovalRequestedAt }));
            setShowRemoveBrand(false);
            toast('Brand removal scheduled. You have 30 days to cancel.');
          }}
        />
      )}
    </>
  );
}
