import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { uploadBrandLogo } from '../lib/db';
import { supabase } from '../lib/supabase';

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

const labelStyle = {
  display:      'block',
  color:        B.muted,
  fontSize:     13,
  fontWeight:   600,
  marginBottom: 6,
  letterSpacing: 0.3,
};

// Brand name cooldown: 30 days between changes
const BRAND_NAME_COOLDOWN_DAYS = 30;

export default function BrandProfileEditScreen({ onClose, onSaved }) {
  const { currentUser, setCurrentUser, toast } = useApp();

  const [brandName,        setBrandName]        = useState(currentUser.brandName        || '');
  const [brandDescription, setBrandDescription] = useState(currentUser.brandDescription || '');
  const [brandEmail,       setBrandEmail]       = useState(currentUser.brandEmail       || '');
  const [logoFile,         setLogoFile]         = useState(null);
  const [logoPreview,      setLogoPreview]      = useState(currentUser.brandLogoUrl     || null);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');
  const fileRef = useRef(null);

  // ── Links ──────────────────────────────────────────────────
  // SLurl and Marketplace save straight away — their format proves where they
  // go. A website can go anywhere, so it's held for review and shows nowhere
  // until an admin approves it. Loaded here rather than from currentUser so
  // the screen always reflects the real review state.
  const [slurl,        setSlurl]        = useState('');
  const [marketplace,  setMarketplace]  = useState('');
  const [website,      setWebsite]      = useState('');
  const [linkState,    setLinkState]    = useState({ status: 'none', approved: null, pending: null, reason: null });
  const [linksLoading, setLinksLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('brand_slurl, brand_marketplace_url, website_url, website_pending, website_status, website_reject_reason')
          .eq('id', currentUser.id)
          .single();
        if (!alive || !data) return;
        setSlurl(data.brand_slurl || '');
        setMarketplace(data.brand_marketplace_url || '');
        setWebsite(data.website_pending || data.website_url || '');
        setLinkState({
          status:   data.website_status || 'none',
          approved: data.website_url,
          pending:  data.website_pending,
          reason:   data.website_reject_reason,
        });
      } catch (e) {
        console.warn('Could not load brand links:', e.message);
      } finally {
        if (alive) setLinksLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser.id]);

  // Check brand name cooldown
  const lastNameChange = currentUser.brandNameChangedAt
    ? new Date(currentUser.brandNameChangedAt)
    : currentUser.brandActivatedAt
      ? new Date(currentUser.brandActivatedAt)
      : null;

  const cooldownEnds = lastNameChange
    ? new Date(lastNameChange.getTime() + BRAND_NAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const nameOnCooldown = cooldownEnds && cooldownEnds > new Date();
  const cooldownDaysLeft = nameOnCooldown
    ? Math.ceil((cooldownEnds - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const nameChanged = brandName.trim() !== (currentUser.brandName || '').trim();

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2 MB.'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSave = async () => {
    if (!brandName.trim())        { setError('Brand name is required.'); return; }
    if (!brandDescription.trim()) { setError('Brand description is required.'); return; }
    if (nameChanged && nameOnCooldown) { setError(`You can change your brand name again in ${cooldownDaysLeft} day${cooldownDaysLeft !== 1 ? 's' : ''}.`); return; }

    setSaving(true);
    setError('');

    try {
      let logoUrl = currentUser.brandLogoUrl;

      if (logoFile) {
        logoUrl = await uploadBrandLogo(currentUser.id, logoFile);
      }

      const updates = {
        brand_name:        brandName.trim(),
        brand_description: brandDescription.trim(),
        brand_email:       brandEmail.trim() || null,
        brand_logo_url:    logoUrl,
      };

      // If name changed, record the change timestamp for cooldown
      if (nameChanged) {
        updates.brand_name_changed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      // Links go through their own function: it enforces the formats and
      // decides whether the website needs reviewing. Doing it in SQL means a
      // crafted request can't slip a link past the checks.
      const { data: linkResult, error: linkError } = await supabase.rpc('set_brand_links', {
        p_brand_id:        currentUser.id,
        p_slurl:           slurl.trim()       || null,
        p_marketplace_url: marketplace.trim() || null,
        p_website:         website.trim()     || null,
      });
      if (linkError) throw linkError;

      if (linkResult?.status === 'error') {
        setError(linkResult.reason || 'One of your links could not be saved.');
        setSaving(false);
        return;
      }

      setLinkState({
        status:   linkResult?.website_status || 'none',
        approved: linkResult?.website_url,
        pending:  linkResult?.website_pending,
        reason:   null,
      });

      // Update local state
      setCurrentUser(u => ({
        ...u,
        brandName:        brandName.trim(),
        brandDescription: brandDescription.trim(),
        brandEmail:       brandEmail.trim() || null,
        brandLogoUrl:     logoUrl,
        ...(nameChanged ? { brandNameChangedAt: new Date().toISOString() } : {}),
      }));

      toast('Brand profile updated ✓');
      onSaved?.();
      onClose();
    } catch (e) {
      setError('Something went wrong — please try again.');
      console.error('Brand profile save failed:', e.message);
    } finally {
      setSaving(false);
    }
  };

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
            <div style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>Edit Brand Profile</div>
            <div style={{ color: B.muted, fontSize: 12, marginTop: 2 }}>{currentUser.brandName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: B.muted, fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ padding: '24px 20px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: 18,
                background: logoPreview ? 'transparent' : 'rgba(0,180,200,0.1)',
                border: `2px dashed ${logoPreview ? B.sky : B.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
              }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28 }}>🏷️</span>
              }
            </div>
            <div>
              <div style={{ color: B.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Brand logo</div>
              <div style={{ color: B.muted, fontSize: 12, marginBottom: 8 }}>Square image recommended · Max 2 MB</div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${B.border}`, borderRadius: 7, color: B.bright, fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}
              >
                {logoPreview ? 'Change logo' : 'Upload logo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
          </div>

          {/* Brand name */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Brand name</label>
            <input
              type="text"
              style={{ ...inputStyle, opacity: 0.5 }}
              value={brandName}
              readOnly
            />
            <div style={{ color: B.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              {cooldownDaysLeft > 0
                ? `${cooldownDaysLeft} day${cooldownDaysLeft !== 1 ? 's' : ''} before you can change your brand name.`
                : 'You can change your brand name once every 30 days.'
              }{' '}
              Made a mistake?{' '}
              <a href="mailto:support@incynq.net?subject=Brand name change request" style={{ color: B.sky, textDecoration: 'none' }}>
                No worries, contact support.
              </a>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Description *</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              value={brandDescription}
              onChange={e => setBrandDescription(e.target.value)}
              placeholder="Tell residents what your brand is about…"
              maxLength={200}
            />
            <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{brandDescription.length}/200</div>
          </div>

          {/* ── Links ── */}
          <div style={{ margin: '28px 0 14px', color: B.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            WHERE PEOPLE CAN FIND YOU
          </div>
          <div style={{ color: B.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>
            Add these once and you can use them as buttons on any ad you run — no retyping.
          </div>

          {/* SLurl */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Inworld location (SLurl)</label>
            <input
              type="text"
              style={inputStyle}
              value={slurl}
              onChange={e => setSlurl(e.target.value)}
              placeholder="https://maps.secondlife.com/secondlife/Region/128/128/25"
              disabled={linksLoading}
            />
            <div style={{ color: B.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              Copy this from the world map inworld, or from your parcel's About Land.
            </div>
          </div>

          {/* Marketplace */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Marketplace store</label>
            <input
              type="text"
              style={inputStyle}
              value={marketplace}
              onChange={e => setMarketplace(e.target.value)}
              placeholder="https://marketplace.secondlife.com/stores/…"
              disabled={linksLoading}
            />
          </div>

          {/* Website — reviewed */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Website</label>
            <input
              type="text"
              style={inputStyle}
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
              disabled={linksLoading}
            />

            {linkState.status === 'pending' ? (
              <div style={{ marginTop: 8, background: 'rgba(244,185,66,0.08)', border: '1px solid rgba(244,185,66,0.25)', borderRadius: 10, padding: '10px 12px', color: B.gold, fontSize: 12, lineHeight: 1.6 }}>
                ⏳ We're checking this one. It won't show anywhere until we've had a look — usually within a day or two.
                {linkState.approved && (
                  <div style={{ color: B.muted, marginTop: 4 }}>
                    Your current website stays live in the meantime.
                  </div>
                )}
              </div>
            ) : linkState.status === 'approved' ? (
              <div style={{ marginTop: 8, color: '#00e5a0', fontSize: 12, lineHeight: 1.6 }}>
                ✓ Approved and live. Change it and we'll check the new one before it goes up.
              </div>
            ) : linkState.status === 'rejected' ? (
              <div style={{ marginTop: 8, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, padding: '10px 12px', color: '#ff6b6b', fontSize: 12, lineHeight: 1.6 }}>
                We couldn't approve that one.{linkState.reason ? ` ${linkState.reason}` : ''} Try a different address, or{' '}
                <a href="mailto:support@incynq.net?subject=Website link" style={{ color: B.sky, textDecoration: 'none' }}>get in touch</a>.
              </div>
            ) : (
              <div style={{ color: B.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                We check every website before it goes live, so this one won't show straight away.
                Must start with <strong style={{ color: B.bright }}>https://</strong> — link shorteners aren't accepted.
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ff6b6b', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display:      'block',
              width:        '100%',
              padding:      '14px 0',
              background:   saving ? 'rgba(0,180,200,0.4)' : B.sky,
              border:       'none',
              borderRadius: 10,
              color:        '#fff',
              fontSize:     16,
              fontWeight:   700,
              cursor:       saving ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
