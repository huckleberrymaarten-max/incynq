import logo from '../assets/Q_Logo_.png';

export default function MaintenancePage({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#040f14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        background: '#071820',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid #0f3848',
      }}>
        {/* Header */}
        <div style={{
          background: '#00b4c8',
          padding: '32px 32px 28px',
        }}>
          <img src={logo} alt="InCynq" style={{ width: 52, height: 52, objectFit: 'contain', display: 'block', marginBottom: 14 }} />
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10, opacity: 0.8 }}>
            MAINTENANCE
          </div>
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.5 }}>
            We'll be back<br />
            <span style={{ color: '#f0a500' }}>shortly.</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px' }}>
          {/* Status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#f0a50018', border: '1px solid #f0a50044',
            borderRadius: 20, padding: '6px 14px', marginBottom: 20,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0a500', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f0a500' }}>Maintenance in progress</span>
          </div>

          <p style={{ fontSize: 14, color: '#8cc4d0', lineHeight: 1.7, marginBottom: 16 }}>
            {message || "We're making improvements behind the scenes. The site will be back up as soon as possible."}
          </p>

          <p style={{ fontSize: 13, color: '#4a8090', lineHeight: 1.7, marginBottom: 8 }}>
            The InCynq app at <strong style={{ color: '#00b4c8' }}>incynq.app</strong> may still be accessible during this time.
          </p>

          <p style={{ fontSize: 13, color: '#4a8090', lineHeight: 1.7 }}>
            Urgent? Email us at <a href="mailto:support@incynq.net" style={{ color: '#00b4c8', textDecoration: 'none', fontWeight: 600 }}>support@incynq.net</a>
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid #0f3848', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#1a4a5a', margin: 0 }}>
            © 2026 InCynq · Operated from Ireland · Not affiliated with Linden Lab or Second Life®
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
