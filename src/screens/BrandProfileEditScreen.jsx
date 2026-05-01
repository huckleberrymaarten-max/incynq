import { useState, useRef } from 'react';
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
