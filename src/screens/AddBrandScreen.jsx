import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { initBrandActivation, checkBrandActivated, cancelBrandActivation, uploadBrandLogo } from '../lib/db';
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

// ══════════════════════════════════════════════════════════════
// STEP 1 — Brand Info Form
// ══════════════════════════════════════════════════════════════
function StepInfo({ onNext, onClose }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [email,       setEmail]       = useState('');
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
    if (!name.trim())        { setError('Brand name is required.'); return; }
    if (!description.trim()) { setError('Brand description is required.'); return; }
    setError('');
    onNext({ name, description, email, logoFile, logoPreview });
  };

  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Set up your brand
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
        Tell the community who you are. This information appears on your brand profile and can be edited later.
      </p>

      {/* Logo */}
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
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Brand name *</label>
        <input
          type="text"
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Midnight Couture"
          maxLength={50}
        />
        <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{name.length}/50</div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Description *</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Tell residents what your brand is about…"
          maxLength={200}
        />
        <div style={{ color: B.muted, fontSize: 11, marginTop: 4, textAlign: 'right' }}>{description.length}/200</div>
      </div>

      {/* Brand email */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Brand contact email <span style={{ color: B.muted, fontWeight: 400 }}>(optional)</span></label>
        <input
          type="email"
          style={inputStyle}
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="hello@yourbrand.com"
        />
        <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>Visible on your brand profile as a contact option.</div>
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
function StepReview({ brandData, activationFee, onConfirm, onBack, loading }) {
  const BRAND_ACTIVATION_FEE = activationFee || 3500;
  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Review your brand
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
        This is how your brand will appear to the InCynq community.
      </p>

      {/* Brand card preview */}
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
          {brandData.logoPreview
            ? <img src={brandData.logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 24 }}>🏷️</span>
          }
        </div>
        <div>
          <div style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>{brandData.name}</div>
          <div style={{ color: B.sky, fontSize: 12, marginBottom: 6 }}>Brand account</div>
          <div style={{ color: B.bright, fontSize: 13, lineHeight: 1.5 }}>{brandData.description}</div>
          {brandData.email && (
            <div style={{ color: B.muted, fontSize: 12, marginTop: 6 }}>✉️ {brandData.email}</div>
          )}
        </div>
      </div>

      {/* Activation fee notice */}
      <div style={{
        background: 'rgba(244,185,66,0.08)', border: '1px solid rgba(244,185,66,0.2)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 24,
      }}>
        <div style={{ color: B.gold, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          💰 Activation fee: {BRAND_ACTIVATION_FEE.toLocaleString()} L$
        </div>
        <div style={{ color: B.bright, fontSize: 13, lineHeight: 1.5 }}>
          Paid inworld via an InCynq ATM. This amount becomes your opening Brand Wallet — it's yours to spend on ads and events. Non-refundable per our T&C.
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
function StepPayment({ activationCode, activationFee, onActivated, onCancel, userId }) {
  const BRAND_ACTIVATION_FEE = activationFee || 3500;
  const [copied, setCopied]   = useState(false);
  const [status, setStatus]   = useState('waiting'); // waiting | activated
  const intervalRef           = useRef(null);

  useEffect(() => {
    // Poll every 4 seconds for brand activation
    intervalRef.current = setInterval(async () => {
      try {
        const result = await checkBrandActivated(userId);
        if (result) {
          clearInterval(intervalRef.current);
          setStatus('activated');
          setTimeout(() => onActivated(result), 800);
        }
      } catch (e) {
        console.warn('Brand activation poll error:', e.message);
      }
    }, 4000);

    return () => clearInterval(intervalRef.current);
  }, [userId, onActivated]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'activated') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h2 style={{ color: B.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Brand activated!</h2>
        <p style={{ color: B.bright, fontSize: 15 }}>Setting up your brand account…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: B.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
        Pay inworld to activate
      </h2>
      <p style={{ color: B.bright, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
        Head to any InCynq ATM inworld. Pay exactly <strong style={{ color: B.gold }}>{BRAND_ACTIVATION_FEE.toLocaleString()} L$</strong> with this code in the payment description.
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
          { n: 3, text: `Pay exactly ${BRAND_ACTIVATION_FEE.toLocaleString()} L$ to IncynqPayments` },
          { n: 4, text: `Enter code: ${activationCode} as payment description` },
          { n: 5, text: 'Return here — your brand activates automatically' },
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
export default function AddBrandScreen({ onClose, onActivated }) {
  const { appContent } = useContent();
  const BRAND_ACTIVATION_FEE = parseInt(appContent?.brand_activation_fee || 3500);
  const { currentUser } = useApp();
  const [step,           setStep]           = useState(1);
  const [brandData,      setBrandData]      = useState(null);
  const [activationCode, setActivationCode] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error,          setError]          = useState('');

  const handleInfoNext = (data) => {
    setBrandData(data);
    setStep(2);
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    setError('');
    try {
      // Upload logo first if provided
      let logoUrl = null;
      if (brandData.logoFile) {
        logoUrl = await uploadBrandLogo(currentUser.id, brandData.logoFile);
      }

      const intent = await initBrandActivation(currentUser.id, {
        ...brandData,
        logoUrl,
      });

      setActivationCode(intent.code);
      setStep(3);
    } catch (e) {
      setError('Something went wrong — please try again.');
      console.error('Brand activation init failed:', e.message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelBrandActivation(currentUser.id);
    } catch (e) {
      console.warn('Cancel brand activation failed:', e.message);
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
            <span style={{ color: B.text, fontWeight: 700, fontSize: 16 }}>Add Brand Account</span>
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
              brandData={brandData}
              onConfirm={handleConfirm}
              onBack={() => setStep(1)}
              loading={confirmLoading}
            />
          )}
          {step === 3 && activationCode && (
            <StepPayment
              activationCode={activationCode}
              userId={currentUser.id}
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
