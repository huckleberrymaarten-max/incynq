import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { initPerformerActivation, checkPerformerActivated, cancelPerformerActivation, uploadBrandLogo } from '../lib/db';
import logo from '../assets/Q_Logo_.png';

// ── Brand colours (local, not from theme) ────────────────────
const B = {
  bg:      '#040f14',
  card:    '#0d1f2d',
  card2:   '#0a1a24',
  border:  'rgba(255,255,255,0.08)',
  text:    '#ffffff',
  muted:   '#7a909e',
  sky:     '#00B4C8',
  gold:    '#F4B942',
  bright:  '#b0c4d0',
};

// ── Shared input style ────────────────────────────────────────
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

const PERFORMER_TYPES = [
  { value: 'dj',   label: 'DJ' },
  { value: 'live', label: 'Live Artist' },
  { value: 'both', label: 'Both' },
];

const typeLabel = (t) => t === 'both' ? 'DJ + Live Artist' : t === 'live' ? 'Live Artist' : 'DJ';

// ══════════════════════════════════════════════════════════════
// STEP 1 — Performer Info Form
// ══════════════════════════════════════════════════════════════
function StepInfo({ onNext, onClose }) {
  const [name,        setName]        = useState('');
  const [performerType, setPerformerType] = useState('dj');
  const [genresText,  setGenresText]  = useState('');
  const [streamUrl,   setStreamUrl]   = useState('');
  const [homeSlurl,   setHomeSlurl]   = useState('');
  const [bio,         setBio]         = useState('');
  const [sampleUrl,   setSampleUrl]   = useState('');
  const [logoFile,    setLogoFile]    = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error,       setError]       = useState('');
  const fileRef = useRef(null);

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2 MB.'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleNext = () => {
    if (!name.trim()) { setError('Stage name is required.'); return; }
    if (!bio.trim())  { setError('A short bio is required.'); return; }
    const genres = genresText.split(',').map(g => g.trim()).filter(Boolean);
    setError('');
    onNext({ name, performerType, genres, streamUrl, homeSlurl, bio, sampleUrl, logoFile, logoPreview });
  };

  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Set up your performer identity
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
        Your DJ / live identity gets its own handle, followers, and tip jar. This info appears on your performer profile and can be edited later.
      </p>

      {/* Logo / avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 72, height: 72, borderRadius: 16,
            background: logoPreview ? 'transparent' : 'rgba(0,180,200,0.1)',
            border: `2px dashed ${logoPreview ? B.sky : B.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
          }}
        >
          {logoPreview
            ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 28 }}>🎧</span>
          }
        </div>
        <div>
          <div style={{ color: B.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Performer logo / avatar</div>
          <div style={{ color: B.muted, fontSize: 12, marginBottom: 8 }}>Square image recommended · Max 2 MB</div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${B.border}`, borderRadius: 7, color: B.bright, fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}
          >
            {logoPreview ? 'Change image' : 'Upload image'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
      </div>

      {/* Stage name */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Stage name *</label>
        <input
          type="text"
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. DJMAX"
          maxLength={50}
        />
        <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{name.length}/50</div>
      </div>

      {/* Performer type */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>You perform as *</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERFORMER_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setPerformerType(t.value)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                border: `1px solid ${performerType === t.value ? B.sky : B.border}`,
                background: performerType === t.value ? 'rgba(0,180,200,0.12)' : 'transparent',
                color: performerType === t.value ? B.sky : B.muted,
                fontWeight: performerType === t.value ? 700 : 500,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genres */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Genres <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
        <input
          type="text"
          style={inputStyle}
          value={genresText}
          onChange={e => setGenresText(e.target.value)}
          placeholder="e.g. House, Techno, Trance"
        />
        <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>Separate with commas. Helps people find you in Discover.</div>
      </div>

      {/* Default stream link */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Default stream link <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
        <input
          type="text"
          style={inputStyle}
          value={streamUrl}
          onChange={e => setStreamUrl(e.target.value)}
          placeholder="https://your-stream-url"
        />
        <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>The stream your sets play from. You can set this per gig too.</div>
      </div>

      {/* Home venue SLURL */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Home venue SLURL <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
        <input
          type="text"
          style={inputStyle}
          value={homeSlurl}
          onChange={e => setHomeSlurl(e.target.value)}
          placeholder="secondlife://..."
        />
      </div>

      {/* Bio */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Bio *</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Tell the crowd what your sets are about…"
          maxLength={200}
        />
        <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{bio.length}/200</div>
      </div>

      {/* Sample link */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Sample set / mix link <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
        <input
          type="text"
          style={inputStyle}
          value={sampleUrl}
          onChange={e => setSampleUrl(e.target.value)}
          placeholder="A SoundCloud / Mixcloud / YouTube link"
        />
      </div>

      {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <button
        onClick={handleNext}
        style={{
          display: 'block', width: '100%', padding: '14px 0',
          background: B.sky, border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        Continue →
      </button>
      <button
        onClick={onClose}
        style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 2 — Review + Confirm
// ══════════════════════════════════════════════════════════════
function StepReview({ performerData, activationFee, hourRate, onConfirm, onBack, loading }) {
  const FEE  = activationFee || 1750;
  const rate = hourRate || 175;
  const hours = rate > 0 ? Math.round(FEE / rate) : 0;
  const genres = performerData.genres || [];

  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Review your performer identity
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
        This is how you will appear to the InCynq community.
      </p>

      {/* Performer card preview */}
      <div style={{
        background: B.card, border: `1px solid ${B.border}`,
        borderRadius: 14, padding: '20px 18px', marginBottom: 24,
        display: 'flex', gap: 16, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 12, overflow: 'hidden',
          background: 'rgba(0,180,200,0.1)', border: `1px solid ${B.border}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {performerData.logoPreview
            ? <img src={performerData.logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 24 }}>🎧</span>
          }
        </div>
        <div>
          <div style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>{performerData.name}</div>
          <div style={{ color: B.sky, fontSize: 12, marginBottom: 6 }}>
            {typeLabel(performerData.performerType)}{genres.length ? ` · ${genres.join(', ')}` : ''}
          </div>
          <div style={{ color: B.bright, fontSize: 13, lineHeight: 1.5 }}>{performerData.bio}</div>
          {performerData.streamUrl && (
            <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>🔗 {performerData.streamUrl}</div>
          )}
        </div>
      </div>

      {/* Activation fee notice */}
      <div style={{
        background: 'rgba(244,185,66,0.08)', border: '1px solid rgba(244,185,66,0.2)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 24,
      }}>
        <div style={{ color: B.gold, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          💰 Activation: {FEE.toLocaleString()} L$ → your airtime wallet
        </div>
        <div style={{ color: B.bright, fontSize: 13, lineHeight: 1.5 }}>
          Paid inworld via an InCynq ATM. The full amount lands in your wallet as broadcast credit{hours ? ` — about ${hours} hours on air at the current rate` : ''}. Spend it on airtime, top up any time. Non-refundable per our T&C.
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={loading}
        style={{
          display: 'block', width: '100%', padding: '14px 0',
          background: B.sky, border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1, marginBottom: 12,
        }}
      >
        {loading ? 'Setting up…' : 'Confirm and get activation code'}
      </button>
      <button
        onClick={onBack}
        disabled={loading}
        style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}
      >
        ← Back
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 3 — Payment instructions + waiting for ATM
// ══════════════════════════════════════════════════════════════
function StepPayment({ activationCode, activationFee, onActivated, onCancel, performerId }) {
  const FEE = activationFee || 1750;
  const [copied, setCopied]   = useState(false);
  const [status, setStatus]   = useState('waiting'); // waiting | activated
  const intervalRef           = useRef(null);

  useEffect(() => {
    // Poll every 4 seconds for performer activation (its own profile row).
    intervalRef.current = setInterval(async () => {
      try {
        const result = await checkPerformerActivated(performerId);
        if (result) {
          clearInterval(intervalRef.current);
          setStatus('activated');
          setTimeout(() => onActivated(result), 800);
        }
      } catch (e) {
        console.warn('Performer activation poll error:', e.message);
      }
    }, 4000);

    return () => clearInterval(intervalRef.current);
  }, [performerId, onActivated]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'activated') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h2 style={{ color: B.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>You are on air!</h2>
        <p style={{ color: B.bright, fontSize: 15 }}>Setting up your performer account…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Pay inworld to activate
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
        Head to any InCynq ATM inworld. Pay exactly <strong style={{ color: B.gold }}>{FEE.toLocaleString()} L$</strong> with this code in the payment description.
      </p>

      {/* Activation code */}
      <div style={{
        background: B.card2, border: `2px solid ${B.sky}`,
        borderRadius: 14, padding: '20px 18px', marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ color: B.muted, fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>YOUR ACTIVATION CODE</div>
        <div style={{ color: B.sky, fontSize: 28, fontWeight: 800, letterSpacing: 4, marginBottom: 14, fontFamily: 'monospace' }}>
          {activationCode}
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(0,180,200,0.15)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${copied ? B.sky : B.border}`,
            borderRadius: 8, color: copied ? B.sky : B.bright,
            fontSize: 13, fontWeight: 600, padding: '8px 20px', cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy code'}
        </button>
      </div>

      {/* Step-by-step */}
      <div style={{
        background: B.card, border: `1px solid ${B.border}`,
        borderRadius: 12, padding: '16px 18px', marginBottom: 24,
      }}>
        {[
          { n: 1, text: 'Find an InCynq ATM inworld' },
          { n: 2, text: 'Touch the ATM to begin' },
          { n: 3, text: `Pay exactly ${FEE.toLocaleString()} L$ to IncynqPayments` },
          { n: 4, text: `Enter code: ${activationCode} as payment description` },
          { n: 5, text: 'Return here — your performer identity activates automatically' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: s.n < 5 ? 12 : 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: B.sky,
              color: '#fff', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{s.n}</div>
            <div style={{ color: B.bright, fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{s.text}</div>
          </div>
        ))}
      </div>

      {/* Waiting indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
        color: B.muted, fontSize: 13, marginBottom: 20,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: B.sky,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        Waiting for payment confirmation…
      </div>

      <div style={{ color: B.muted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
        Code expires in 30 minutes
      </div>

      <button
        onClick={onCancel}
        style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}
      >
        Cancel activation
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function AddPerformerScreen({ onClose, onActivated }) {
  const { appContent } = useContent();
  const PERFORMER_FEE = parseInt(appContent?.performer_activation_price || 1750);
  const HOUR_RATE     = parseInt(appContent?.broadcast_hour_price || 175);
  const { currentUser } = useApp();
  const [step,           setStep]           = useState(1);
  const [performerData,  setPerformerData]  = useState(null);
  const [activationCode, setActivationCode] = useState(null);
  const [performerId,    setPerformerId]    = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error,          setError]          = useState('');

  // Slot gate: a performer counts against max_brands, same as a brand.
  const hasPrimaryBrand = !!(currentUser.brandActivatedAt);
  const ownedBrands     = currentUser.ownedBrands || [];
  const totalBrands     = (hasPrimaryBrand ? 1 : 0) + ownedBrands.length;
  const maxBrands       = currentUser.maxBrands || 1;
  const atLimit         = totalBrands >= maxBrands;

  // If at limit, show a contact-support message instead of the form.
  if (atLimit) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#040f14', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Slot limit reached</h2>
          <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
            You are using <strong style={{ color: B.sky }}>{totalBrands}</strong> of <strong style={{ color: B.sky }}>{maxBrands}</strong> brand / performer {maxBrands === 1 ? 'slot' : 'slots'}.
          </p>
          <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            A DJ / performer uses the same slot as a brand. To add another, contact us and we will set you up.
          </p>
          <a href="https://incynq.net/contact.html" target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', width: '100%', padding: '14px 0', background: B.sky, border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', marginBottom: 12 }}>
            Contact support →
          </a>
          <button onClick={onClose}
            style={{ display: 'block', width: '100%', padding: '12px 0', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: 10, color: B.muted, fontSize: 14, cursor: 'pointer' }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const handleInfoNext = (data) => {
    setPerformerData(data);
    setStep(2);
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    setError('');
    try {
      let logoUrl = null;
      if (performerData.logoFile) {
        logoUrl = await uploadBrandLogo(currentUser.id, performerData.logoFile);
      }
      const intent = await initPerformerActivation(currentUser.id, { ...performerData, logoUrl });
      setActivationCode(intent.code);
      setPerformerId(intent.performerId);
      setStep(3);
    } catch (e) {
      if (e.message === 'BRAND_SLOT_LIMIT') {
        setError('You are at your brand / performer slot limit. Contact us to add another.');
      } else {
        setError('Something went wrong — please try again.');
      }
      console.error('Performer activation init failed:', e.message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (performerId) await cancelPerformerActivation(performerId, currentUser.id);
    } catch (e) {
      console.warn('Cancel performer activation failed:', e.message);
    }
    onClose();
  };

  const handleActivated = (result) => {
    onActivated(result);
  };

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: '#040f14',
      zIndex:     200,
      overflowY:  'auto',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px',
          borderBottom:   `1px solid ${B.border}`,
          position:       'sticky',
          top:            0,
          background:     '#040f14',
          zIndex:         10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} alt="InCynq" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>Add DJ / Live Performer</span>
          </div>
          {step < 3 && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: B.muted, fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
          )}
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', paddingBottom: 8 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: s === step ? 20 : 6, height: 6,
                borderRadius: 3,
                background: s <= step ? B.sky : B.border,
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 20px' }}>
          {error && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ff6b6b', fontSize: 14 }}>
              {error}
            </div>
          )}

          {step === 1 && <StepInfo onNext={handleInfoNext} onClose={onClose} />}
          {step === 2 && (
            <StepReview
              performerData={performerData}
              activationFee={PERFORMER_FEE}
              hourRate={HOUR_RATE}
              onConfirm={handleConfirm}
              onBack={() => setStep(1)}
              loading={confirmLoading}
            />
          )}
          {step === 3 && activationCode && (
            <StepPayment
              activationCode={activationCode}
              activationFee={PERFORMER_FEE}
              performerId={performerId}
              onActivated={handleActivated}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
