import { useState } from 'react';
import logo from '../assets/Q_Logo_.png';
import { reactivateAccount } from '../lib/db';

// ── Styles ────────────────────────────────────────────────────
const S = {
  root: {
    minHeight:       '100vh',
    background:      '#040f14',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '24px 16px',
    fontFamily:      "'Inter', sans-serif",
  },
  card: {
    maxWidth:   420,
    width:      '100%',
    textAlign:  'center',
  },
  logo: {
    width:        72,
    height:       72,
    objectFit:    'contain',
    marginBottom: 28,
  },
  heading: {
    color:        '#ffffff',
    fontSize:     22,
    fontWeight:   700,
    margin:       '0 0 12px',
    lineHeight:   1.3,
  },
  body: {
    color:        '#b0c4d0',
    fontSize:     15,
    lineHeight:   1.6,
    margin:       '0 0 32px',
  },
  error: {
    color:        '#ff6b6b',
    fontSize:     13,
    marginBottom: 16,
  },
  btnPrimary: {
    display:       'block',
    width:         '100%',
    padding:       '14px 0',
    background:    '#00B4C8',
    border:        'none',
    borderRadius:  10,
    color:         '#fff',
    fontSize:      16,
    fontWeight:    600,
    cursor:        'pointer',
    marginBottom:  12,
    transition:    'opacity 0.15s',
  },
  btnGhost: {
    display:       'block',
    width:         '100%',
    padding:       '12px 0',
    background:    'transparent',
    border:        '1px solid rgba(255,255,255,0.15)',
    borderRadius:  10,
    color:         '#7a909e',
    fontSize:      15,
    cursor:        'pointer',
    transition:    'opacity 0.15s',
  },
};

export default function DeactivatedScreen({ currentUser, onReactivate, onSignOut }) {
  const [loading,  setLoading]  = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error,    setError]    = useState('');

  const handleReactivate = async () => {
    setLoading(true);
    setError('');
    try {
      await reactivateAccount(currentUser.id);
      onReactivate();
    } catch (e) {
      setError('Something went wrong — please try again.');
      console.error('Reactivate failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div style={S.root}>
      <div style={S.card}>
        <img src={logo} alt="InCynq" style={S.logo} />

        <h2 style={S.heading}>Your account is deactivated</h2>
        <p style={S.body}>
          Good to see you again,{' '}
          <span style={{ color: '#fff' }}>{currentUser.displayName || currentUser.username}</span>!
          Your profile, posts, and followers are all still here —
          just tap below to pick up where you left off.
        </p>

        {error && <p style={S.error}>{error}</p>}

        <button
          onClick={handleReactivate}
          disabled={loading}
          style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Reactivating…' : 'Reactivate my account'}
        </button>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ ...S.btnGhost, opacity: signingOut ? 0.6 : 1 }}
        >
          {signingOut ? 'Signing out…' : 'Sign out instead'}
        </button>
      </div>
    </div>
  );
}
