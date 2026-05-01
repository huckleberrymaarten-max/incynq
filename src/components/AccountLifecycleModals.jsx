import { useState } from 'react';
import { deactivateAccount, requestAccountDeletion, requestBrandRemoval } from '../lib/db';

// ══════════════════════════════════════════════════════════════
// AccountLifecycleModals
// ──────────────────────────────────────────────────────────────
// Exports two modals:
//   <DeactivateModal />   — deactivates the account (soft, reversible)
//   <DeleteModal />       — requests permanent deletion (cool-off applies)
//
// HOW TO USE IN SETTINGS:
//   import { DeactivateModal, DeleteModal } from '../components/AccountLifecycleModals';
//
//   1. Add state: const [showDeactivate, setShowDeactivate] = useState(false);
//                 const [showDelete,     setShowDelete]     = useState(false);
//   2. Add buttons in your Danger Zone section:
//        <button onClick={() => setShowDeactivate(true)}>Deactivate account</button>
//        <button onClick={() => setShowDelete(true)}>Delete account</button>
//   3. Render the modals at the bottom of the screen:
//        {showDeactivate && (
//          <DeactivateModal
//            userId={currentUser.id}
//            onClose={() => setShowDeactivate(false)}
//            onConfirm={() => { setCurrentUser(u => ({ ...u, deactivatedAt: new Date().toISOString() })); signOut(); }}
//          />
//        )}
//        {showDelete && (
//          <DeleteModal
//            userId={currentUser.id}
//            accountType={currentUser.accountType}
//            onClose={() => setShowDelete(false)}
//            onConfirm={(deletionRequestedAt) => {
//              setCurrentUser(u => ({ ...u, deletionRequestedAt }));
//              setShowDelete(false);
//            }}
//          />
//        )}
// ══════════════════════════════════════════════════════════════

// ── Shared styles ─────────────────────────────────────────────
const overlay = {
  position:        'fixed',
  inset:           0,
  background:      'rgba(0,0,0,0.75)',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         '24px 16px',
  zIndex:          1000,
};

const card = {
  background:   '#0d1f2d',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding:      '28px 24px',
  maxWidth:     420,
  width:        '100%',
  fontFamily:   "'Inter', sans-serif",
};

const heading = {
  color:        '#fff',
  fontSize:     18,
  fontWeight:   700,
  margin:       '0 0 12px',
};

const body = {
  color:        '#b0c4d0',
  fontSize:     14,
  lineHeight:   1.6,
  margin:       '0 0 20px',
};

const highlight = {
  color:        '#fff',
  fontWeight:   600,
};

const labelStyle = {
  display:      'block',
  color:        '#7a909e',
  fontSize:     13,
  marginBottom: 6,
};

const inputStyle = {
  width:        '100%',
  padding:      '10px 12px',
  background:   'rgba(255,255,255,0.05)',
  border:       '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color:        '#fff',
  fontSize:     14,
  boxSizing:    'border-box',
  marginBottom: 16,
  outline:      'none',
};

const errorStyle = {
  color:        '#ff6b6b',
  fontSize:     13,
  marginBottom: 12,
};

const btnRow = {
  display:   'flex',
  gap:       10,
  marginTop: 8,
};

const btnCancel = {
  flex:         1,
  padding:      '12px 0',
  background:   'transparent',
  border:       '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color:        '#7a909e',
  fontSize:     14,
  cursor:       'pointer',
};

const btnDanger = {
  flex:         1,
  padding:      '12px 0',
  background:   '#8B1F1F',
  border:       'none',
  borderRadius: 8,
  color:        '#fff',
  fontSize:     14,
  fontWeight:   600,
  cursor:       'pointer',
};

const infoBox = (color = '#1a2e3a') => ({
  background:   color,
  border:       `1px solid rgba(255,255,255,0.06)`,
  borderRadius: 8,
  padding:      '12px 14px',
  marginBottom: 20,
  fontSize:     13,
  color:        '#7a909e',
  lineHeight:   1.5,
});

// ══════════════════════════════════════════════════════════════
// DEACTIVATE MODAL
// ══════════════════════════════════════════════════════════════
export function DeactivateModal({ userId, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await deactivateAccount(userId);
      onConfirm();
    } catch (e) {
      setError('Something went wrong — please try again.');
      console.error('Deactivate failed:', e.message);
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h3 style={heading}>Deactivate your account?</h3>

        <p style={body}>
          Your account will be hidden while deactivated — your profile, posts,
          and followers are <span style={highlight}>preserved</span> and waiting
          for you. Just sign back in whenever you're ready.
        </p>

        <div style={infoBox()}>
          ✓ &nbsp;You can reactivate any time by signing in<br />
          ✓ &nbsp;Your wallet balance is kept safe<br />
          ✓ &nbsp;No one can find or follow you while deactivated
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={btnRow}>
          <button style={btnCancel} onClick={onClose} disabled={loading}>
            Keep my account
          </button>
          <button
            style={{ ...btnDanger, opacity: loading ? 0.6 : 1 }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Deactivating…' : 'Yes, deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DELETE MODAL
// ══════════════════════════════════════════════════════════════
export function DeleteModal({ userId, accountType, onClose, onConfirm }) {
  const [step,    setStep]    = useState(1); // 1 = warning, 2 = confirm type
  const [reason,  setReason]  = useState('');
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isBrand     = accountType === 'brand' || accountType === 'founding_brand';
  const graceDays   = isBrand ? 30 : 14;
  const deleteLabel = isBrand ? '30-day grace period' : '14-day cool-off';

  const handleRequest = async () => {
    if (typed.trim().toLowerCase() !== 'delete') {
      setError('Please type DELETE to confirm.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await requestAccountDeletion(userId, reason);
      onConfirm(result.deletion_requested_at);
    } catch (e) {
      setError('Something went wrong — please try again.');
      console.error('Delete request failed:', e.message);
      setLoading(false);
    }
  };

  // ── Step 1: Warning ────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <h3 style={{ ...heading, color: '#ff6b6b' }}>Delete your account?</h3>

          <p style={body}>
            This is permanent. Once the {deleteLabel} ends, your account and
            all its data are <span style={highlight}>gone for good</span> —
            including any <span style={highlight}>linked brand account</span>.
          </p>

          <div style={infoBox('#1f1010')}>
            ✗ &nbsp;All your posts and comments are deleted<br />
            ✗ &nbsp;Your followers and following list are removed<br />
            ✗ &nbsp;Your wallet balance is forfeited (no refunds per our T&C)<br />
            {isBrand && <>✗ &nbsp;Your brand account is permanently removed<br /></>}
            {isBrand && <>✗ &nbsp;Brand Wallet funds are frozen and non-refundable<br /></>}
            ✓ &nbsp;You have {graceDays} days to change your mind<br />
            ✓ &nbsp;This fulfils your right to erasure under GDPR
          </div>

          <div style={btnRow}>
            <button style={btnCancel} onClick={onClose}>
              Keep my account
            </button>
            <button style={btnDanger} onClick={() => setStep(2)}>
              I want to delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Confirm ────────────────────────────────────────
  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h3 style={{ ...heading, color: '#ff6b6b' }}>Final confirmation</h3>

        <p style={body}>
          Your account will be scheduled for deletion.
          You have <span style={highlight}>{graceDays} days</span> to cancel —
          after that it's permanent.
        </p>

        <label style={labelStyle}>Reason for leaving (optional)</label>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={reason}
          onChange={e => setReason(e.target.value)}
        >
          <option value="">Prefer not to say</option>
          <option value="Taking a break">Taking a break</option>
          <option value="Too many notifications">Too many notifications</option>
          <option value="Privacy concerns">Privacy concerns</option>
          <option value="Not finding it useful">Not finding it useful</option>
          <option value="Switching to another platform">Switching to another platform</option>
          <option value="Other">Other</option>
        </select>

        <label style={labelStyle}>
          Type <span style={{ color: '#ff6b6b', fontWeight: 600 }}>DELETE</span> to confirm
        </label>
        <input
          type="text"
          style={inputStyle}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="DELETE"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {error && <p style={errorStyle}>{error}</p>}

        <div style={btnRow}>
          <button style={btnCancel} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            style={{
              ...btnDanger,
              opacity: (typed.trim().toLowerCase() === 'delete' && !loading) ? 1 : 0.4,
            }}
            onClick={handleRequest}
            disabled={loading || typed.trim().toLowerCase() !== 'delete'}
          >
            {loading ? 'Requesting…' : 'Schedule deletion'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REMOVE BRAND MODAL
// ══════════════════════════════════════════════════════════════
export function RemoveBrandModal({ userId, brandName, onClose, onConfirm }) {
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleConfirm = async () => {
    if (typed.trim().toLowerCase() !== 'remove') {
      setError('Please type REMOVE to confirm.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await requestBrandRemoval(userId);
      onConfirm(result.brand_removal_requested_at);
    } catch (e) {
      setError('Something went wrong — please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h3 style={{ ...heading, color: '#ff6b6b' }}>Remove brand account?</h3>

        <p style={body}>
          Your <span style={highlight}>{brandName}</span> brand will be scheduled for removal.
          Your resident account stays untouched — only the brand is removed.
        </p>

        <div style={infoBox('#1f1010')}>
          ✗ &nbsp;Brand profile, posts, and ads are deleted<br />
          ✗ &nbsp;Brand Wallet balance is forfeited (non-refundable)<br />
          ✗ &nbsp;Your manager will lose access<br />
          ✓ &nbsp;Your resident account is kept safe<br />
          ✓ &nbsp;You have 30 days to change your mind<br />
          ✓ &nbsp;This fulfils your right to erasure under GDPR
        </div>

        <label style={labelStyle}>
          Type <span style={{ color: '#ff6b6b', fontWeight: 600 }}>REMOVE</span> to confirm
        </label>
        <input
          type="text"
          style={inputStyle}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="REMOVE"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {error && <p style={errorStyle}>{error}</p>}

        <div style={btnRow}>
          <button style={btnCancel} onClick={onClose} disabled={loading}>Cancel</button>
          <button
            style={{
              ...btnDanger,
              opacity: (typed.trim().toLowerCase() === 'remove' && !loading) ? 1 : 0.4,
            }}
            onClick={handleConfirm}
            disabled={loading || typed.trim().toLowerCase() !== 'remove'}
          >
            {loading ? 'Requesting…' : 'Schedule removal'}
          </button>
        </div>
      </div>
    </div>
  );
}
