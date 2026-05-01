import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getBrandTeam, inviteManager, removeManager } from '../lib/db';
import Av from '../components/Av';

const B = {
  bg:     '#040f14',
  card:   '#0d1f2d',
  card2:  '#0a1a24',
  border: 'rgba(255,255,255,0.08)',
  text:   '#ffffff',
  muted:  '#7a909e',
  bright: '#b0c4d0',
  sky:    '#00B4C8',
  gold:   '#F4B942',
};

const inputStyle = {
  width:        '100%',
  padding:      '12px 14px',
  background:   'rgba(255,255,255,0.05)',
  border:       `1px solid ${B.border}`,
  borderRadius: 10,
  color:        B.text,
  fontSize:     15,
  boxSizing:    'border-box',
  outline:      'none',
  fontFamily:   "'Inter', sans-serif",
};

// ── Invite with search ────────────────────────────────────────
function InviteWithSearch({ onInvite, inviting, error }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const searchTimer                   = useState(null);

  const handleSearch = (val) => {
    setQuery(val);
    setSelected(null);
    if (searchTimer[0]) clearTimeout(searchTimer[0]);
    if (val.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    searchTimer[0] = setTimeout(async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, account_type')
          .ilike('username', `%${val.trim()}%`)
          .neq('account_type', 'official')
          .limit(6);
        setResults(data || []);
      } catch (e) {
        console.warn('Search failed:', e.message);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleSelect = (user) => {
    setSelected(user);
    setQuery(user.username);
    setResults([]);
  };

  return (
    <div>
      <div style={{ color: B.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>INVITE A MANAGER</div>
      <div style={{ color: B.bright, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        Search by SL username to find and invite someone.
      </div>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          style={inputStyle}
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by SL username…"
          autoCapitalize="off"
          autoCorrect="off"
        />
        {searching && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: B.muted, fontSize: 12 }}>
            Searching…
          </div>
        )}

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div style={{
            position:   'absolute',
            top:        '110%',
            left:       0,
            right:      0,
            background: B.card,
            border:     `1px solid ${B.border}`,
            borderRadius: 10,
            overflow:   'hidden',
            zIndex:     50,
            boxShadow:  '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {results.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  width:      '100%',
                  padding:    '10px 14px',
                  display:    'flex',
                  alignItems: 'center',
                  gap:        10,
                  background: 'transparent',
                  border:     'none',
                  borderBottom: `1px solid ${B.border}`,
                  cursor:     'pointer',
                  textAlign:  'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,180,200,0.15)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '👤'
                  }
                </div>
                <div>
                  <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>{user.display_name || user.username}</div>
                  <div style={{ color: B.muted, fontSize: 11 }}>@{user.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected user confirmation */}
      {selected && (
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        10,
          background: 'rgba(0,180,200,0.06)',
          border:     `1px solid rgba(0,180,200,0.2)`,
          borderRadius: 10,
          padding:    '10px 14px',
          marginTop:  12,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,180,200,0.15)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {selected.avatar_url
              ? <img src={selected.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '👤'
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>{selected.display_name || selected.username}</div>
            <div style={{ color: B.sky, fontSize: 11 }}>@{selected.username}</div>
          </div>
          <button onClick={() => { setSelected(null); setQuery(''); }} style={{ background: 'none', border: 'none', color: B.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

      <button
        onClick={() => selected && onInvite(selected.username)}
        disabled={inviting || !selected}
        style={{
          display:      'block',
          width:        '100%',
          padding:      '13px 0',
          background:   selected && !inviting ? B.sky : 'rgba(0,180,200,0.3)',
          border:       'none',
          borderRadius: 10,
          color:        '#fff',
          fontSize:     15,
          fontWeight:   700,
          cursor:       selected && !inviting ? 'pointer' : 'not-allowed',
          marginTop:    14,
        }}
      >
        {inviting ? 'Sending invite…' : selected ? `Invite ${selected.display_name || selected.username}` : 'Select someone to invite'}
      </button>
    </div>
  );
}

export default function BrandTeamScreen({ onClose }) {
  const { currentUser, toast } = useApp();
  const [team,         setTeam]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [inviting,     setInviting]     = useState(false);
  const [removing,     setRemoving]     = useState(null);
  const [error,        setError]        = useState('');

  const loadTeam = async () => {
    try {
      const data = await getBrandTeam(currentUser.id);
      setTeam(data);
    } catch (e) {
      console.error('Load team failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeam(); }, []);

  const handleInvite = async (username) => {
    setInviting(true);
    setError('');
    try {
      const { manager } = await inviteManager(currentUser.id, username);
      toast(`Invite sent to ${manager.display_name || manager.username} ✓`);
      await loadTeam();
    } catch (e) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (managerId, displayName) => {
    if (!window.confirm(`Remove ${displayName} as manager?`)) return;
    setRemoving(managerId);
    try {
      await removeManager(currentUser.id, managerId);
      toast(`${displayName} removed from your team`);
      await loadTeam();
    } catch (e) {
      toast('Could not remove manager — try again', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const accepted = team.filter(t => t.status === 'accepted');
  const pending  = team.filter(t => t.status === 'pending');
  const canInvite = accepted.length === 0 && pending.length === 0;

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: B.bg,
      zIndex:     200,
      overflowY:  'auto',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px',
          borderBottom:   `1px solid ${B.border}`,
          position:       'sticky',
          top:            0,
          background:     B.bg,
          zIndex:         10,
        }}>
          <div>
            <div style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>Brand Team</div>
            <div style={{ color: B.muted, fontSize: 12, marginTop: 2 }}>{currentUser.brandName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: B.muted, fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ padding: '24px 20px' }}>

          {/* What is a manager info box */}
          <div style={{
            background: 'rgba(0,180,200,0.06)',
            border:     `1px solid rgba(0,180,200,0.15)`,
            borderRadius: 12,
            padding:    '14px 16px',
            marginBottom: 28,
            color:      B.bright,
            fontSize:   13,
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: B.sky, marginBottom: 6 }}>What can a manager do?</div>
            ✓ &nbsp;Create posts, events, and ads on behalf of your brand<br />
            ✓ &nbsp;Boost events and top up the Brand Wallet<br />
            ✗ &nbsp;Cannot delete the brand, invite others, or transfer ownership<br />
            ✗ &nbsp;Maximum 1 manager per brand (need more? <a href="mailto:support@incynq.net?subject=Additional manager request" style={{ color: '#00B4C8', textDecoration: 'none' }}>contact us</a>)
          </div>

          {/* Current manager / invite section */}
          {loading ? (
            <div style={{ color: B.muted, textAlign: 'center', padding: '40px 0' }}>Loading…</div>
          ) : (
            <>
              {/* Active manager */}
              {accepted.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ color: B.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CURRENT MANAGER</div>
                  {accepted.map(t => (
                    <div key={t.id} style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        12,
                      background: B.card,
                      border:     `1px solid ${B.border}`,
                      borderRadius: 12,
                      padding:    '14px 16px',
                    }}>
                      <Av user={t.manager} size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: B.text, fontWeight: 600, fontSize: 14 }}>
                          {t.manager.display_name || t.manager.username}
                        </div>
                        <div style={{ color: B.muted, fontSize: 12 }}>@{t.manager.username}</div>
                        <div style={{ color: '#5DCAA5', fontSize: 11, marginTop: 2 }}>
                          ✓ Active since {new Date(t.accepted_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(t.manager.id, t.manager.display_name || t.manager.username)}
                        disabled={removing === t.manager.id}
                        style={{
                          background:   'rgba(255,107,107,0.1)',
                          border:       '1px solid rgba(255,107,107,0.25)',
                          borderRadius: 8,
                          color:        '#ff6b6b',
                          fontSize:     12,
                          padding:      '6px 12px',
                          cursor:       'pointer',
                          opacity:      removing === t.manager.id ? 0.5 : 1,
                        }}
                      >
                        {removing === t.manager.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending invite */}
              {pending.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ color: B.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>PENDING INVITE</div>
                  {pending.map(t => (
                    <div key={t.id} style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        12,
                      background: 'rgba(244,185,66,0.06)',
                      border:     '1px solid rgba(244,185,66,0.2)',
                      borderRadius: 12,
                      padding:    '14px 16px',
                    }}>
                      <Av user={t.manager} size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: B.text, fontWeight: 600, fontSize: 14 }}>
                          {t.manager.display_name || t.manager.username}
                        </div>
                        <div style={{ color: B.muted, fontSize: 12 }}>@{t.manager.username}</div>
                        <div style={{ color: B.gold, fontSize: 11, marginTop: 2 }}>⏳ Waiting for response…</div>
                      </div>
                      <button
                        onClick={() => handleRemove(t.manager.id, t.manager.display_name || t.manager.username)}
                        disabled={removing === t.manager.id}
                        style={{
                          background:   'transparent',
                          border:       `1px solid ${B.border}`,
                          borderRadius: 8,
                          color:        B.muted,
                          fontSize:     12,
                          padding:      '6px 12px',
                          cursor:       'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Invite form — only show if no active manager or pending invite */}
              {canInvite ? (
                <InviteWithSearch
                  onInvite={handleInvite}
                  inviting={inviting}
                  error={error}
                />
              ) : (
                <div style={{
                  background:   B.card,
                  border:       `1px solid ${B.border}`,
                  borderRadius: 12,
                  padding:      '16px',
                  color:        B.muted,
                  fontSize:     13,
                  lineHeight:   1.6,
                  textAlign:    'center',
                }}>
                  You can have 1 manager at a time. Remove the current manager or cancel the pending invite to add a new one.
                  <br />
                  <a href="mailto:support@incynq.net?subject=Additional manager request" style={{ color: '#00B4C8', textDecoration: 'none', marginTop: 6, display: 'inline-block' }}>
                    Need more than 1 manager? Contact us
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
