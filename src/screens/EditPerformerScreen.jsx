import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import logo from '../assets/Q_Logo_.png';

// ── Brand colours (local, matches AddPerformerScreen) ─────────
const B = {
  bg:     '#040f14',
  card:   '#0d1f2d',
  card2:  '#0a1a24',
  border: 'rgba(255,255,255,0.08)',
  text:   '#ffffff',
  muted:  '#7a909e',
  sky:    '#00B4C8',
  gold:   '#F4B942',
  bright: '#b0c4d0',
};

const inputStyle = {
  width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${B.border}`, borderRadius: 10, color: B.text, fontSize: 15,
  boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter', sans-serif",
};
const labelStyle = {
  display: 'block', color: B.muted, fontSize: 13, fontWeight: 600,
  marginBottom: 6, letterSpacing: 0.3,
};

const PERFORMER_TYPES = [
  { value: 'dj',   label: 'DJ' },
  { value: 'live', label: 'Live Artist' },
  { value: 'both', label: 'Both' },
];

export default function EditPerformerScreen({ onClose }) {
  const { currentUser, toast } = useApp();
  const performer   = (currentUser.ownedBrands || []).find(b => b.id === currentUser.activePerformerId);
  const performerId = performer?.id;

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [performerType, setPerformerType] = useState('dj');
  const [genresText,    setGenresText]    = useState('');
  const [streamUrl,     setStreamUrl]     = useState('');
  const [homeSlurl,     setHomeSlurl]     = useState('');
  const [bio,           setBio]           = useState('');
  const [sampleUrl,     setSampleUrl]     = useState('');
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (!performerId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [{ data: prof }, { data: pp }] = await Promise.all([
          supabase.from('profiles').select('brand_description, performer_type').eq('id', performerId).single(),
          supabase.from('performer_profiles').select('genres, stream_url, home_slurl, sample_url').eq('profile_id', performerId).single(),
        ]);
        if (cancelled) return;
        setPerformerType(prof?.performer_type || 'dj');
        setBio(prof?.brand_description || '');
        const genres = Array.isArray(pp?.genres) ? pp.genres : [];
        setGenresText(genres.join(', '));
        setStreamUrl(pp?.stream_url || '');
        setHomeSlurl(pp?.home_slurl || '');
        setSampleUrl(pp?.sample_url || '');
      } catch (e) {
        console.warn('Load performer profile failed:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [performerId]);

  const handleSave = async () => {
    if (!bio.trim()) { setError('A short bio is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const genres = genresText.split(',').map(g => g.trim()).filter(Boolean);
      const { data, error: rpcErr } = await supabase.rpc('update_performer_profile', {
        p_performer_id:   performerId,
        p_bio:            bio.trim(),
        p_performer_type: performerType,
        p_genres:         genres,
        p_stream_url:     streamUrl.trim() || null,
        p_home_slurl:     homeSlurl.trim() || null,
        p_sample_url:     sampleUrl.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      if (!data?.ok) throw new Error(data?.error || 'Could not save');
      toast('Profile updated');
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: B.bg, zIndex: 200, overflowY: 'auto', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${B.border}`, position: 'sticky', top: 0, background: B.bg, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} alt="InCynq" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>Edit performer profile</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: B.muted, fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ padding: '28px 20px' }}>
          {loading ? (
            <div style={{ color: B.muted, textAlign: 'center', padding: 60 }}>Loading…</div>
          ) : !performer ? (
            <div style={{ color: B.muted, textAlign: 'center', padding: 60 }}>Performer not found.</div>
          ) : (
            <>
              {/* Stage name — read only (admin changes this) */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Stage name</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: B.bright, background: 'rgba(255,255,255,0.03)' }}>
                  <span>{performer.brand_name}</span>
                  <span style={{ fontSize: 11, color: B.muted }}>🔒 admin only</span>
                </div>
                <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>Want a different stage name? <a href="https://incynq.net/contact" target="_blank" rel="noopener noreferrer" style={{ color: B.sky, textDecoration: 'underline' }}>Contact us</a> and we'll change it for you.</div>
              </div>

              {/* Performer type */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>You perform as *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PERFORMER_TYPES.map(t => (
                    <button key={t.value} onClick={() => setPerformerType(t.value)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10,
                        border: `1px solid ${performerType === t.value ? B.sky : B.border}`,
                        background: performerType === t.value ? 'rgba(0,180,200,0.12)' : 'transparent',
                        color: performerType === t.value ? B.sky : B.muted,
                        fontWeight: performerType === t.value ? 700 : 500, fontSize: 14, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Genres <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
                <input type="text" style={inputStyle} value={genresText} onChange={e => setGenresText(e.target.value)} placeholder="e.g. House, Techno, Trance" />
                <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>Separate with commas. Helps people find you in Discover.</div>
              </div>

              {/* Default stream link */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Default stream link <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
                <input type="text" style={inputStyle} value={streamUrl} onChange={e => setStreamUrl(e.target.value)} placeholder="https://your-stream-url" />
                <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>The stream your sets play from. You can set this per gig too.</div>
              </div>

              {/* Home venue SLURL */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Home venue SLURL <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
                <input type="text" style={inputStyle} value={homeSlurl} onChange={e => setHomeSlurl(e.target.value)} placeholder="secondlife://..." />
              </div>

              {/* Bio */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Bio *</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the crowd what your sets are about…" maxLength={200} />
                <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{bio.length}/200</div>
              </div>

              {/* Sample link */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Sample set / mix link <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
                <input type="text" style={inputStyle} value={sampleUrl} onChange={e => setSampleUrl(e.target.value)} placeholder="A SoundCloud / Mixcloud / YouTube link" />
              </div>

              {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

              <button onClick={handleSave} disabled={saving}
                style={{ display: 'block', width: '100%', padding: '14px 0', background: B.sky, border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, marginBottom: 12 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={onClose} disabled={saving}
                style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
