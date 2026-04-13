import C from '../theme';
import { TC_DATA } from '../data/tcData';

export default function TCScreen({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.bg, zIndex: 900,
      display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
        background: C.card, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300 }}>←</button>
        <div>
          <div className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Terms & Conditions</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Last updated: {TC_DATA.lastUpdated}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>

        {/* Intro box */}
        <div style={{
          padding: '12px 16px', background: `${C.sky}0a`,
          border: `1px solid ${C.sky}22`, borderRadius: 12,
          fontSize: 13, color: C.sub, lineHeight: 1.7, marginBottom: 24,
        }}>
          {TC_DATA.intro}
        </div>

        {/* Sections */}
        {TC_DATA.sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 10 }}>
              {sec.title}
            </div>
            {sec.content.split('\n\n').map((para, pi) => (
              <p key={pi} style={{ fontSize: 13, color: C.sub, lineHeight: 1.8, marginBottom: 8 }}>
                {para}
              </p>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          padding: '14px 16px', background: C.card, borderRadius: 12,
          border: `1px solid ${C.border}`, fontSize: 12, color: C.muted,
          lineHeight: 1.7, textAlign: 'center',
        }}>
          {TC_DATA.footer.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
