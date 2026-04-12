import { useState } from 'react';
import C from '../theme';

const SLIDES = [
  {
    id: 'problem',
    content: () => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>The problem</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 16 }}>
          Your group chat<br />
          <span style={{ color: '#ff4466' }}>needs a break.</span>
        </h1>
        <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.7 }}>
          Hundreds of messages a day. Sales you never asked for. Events from sims you visited once. Sound familiar?
        </p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['📢 SALE ENDS TONIGHT! 50% off everything!', '🎉 DJ NIGHT!! Come to the Neon Lounge tonight!!', '💸 NEW RELEASES! Mesh body update available NOW', '📣 EVENT! Event! EVENT!! Be there or be square'].map((m, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 10, padding: '9px 12px', fontSize: 12, color: C.sub, borderLeft: `3px solid #ff446644`, opacity: 1 - i * 0.15 }}>
              {m}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'solution',
    content: () => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>The solution</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 16 }}>
          Finally.<br />
          <span style={{ background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>A feed worth opening.</span>
        </h1>
        <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.7 }}>
          InCynq lets you follow the brands and people you actually care about. Your feed. Your rules.
        </p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '🎯', text: 'Content matched to your interests only' },
            { icon: '🔕', text: 'No group chat spam — ever' },
            { icon: '✅', text: 'Every account verified via Second Life' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 14, color: C.sub }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'how',
    content: () => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 24 }}>
          Three steps.<br />
          <span style={{ color: C.sky }}>That is it.</span>
        </h1>
        {[
          { n: '1', title: 'Pick your interests', desc: 'Fashion, roleplay, creators, nightlife — whatever you are into in Second Life.' },
          { n: '2', title: 'Follow brands you love', desc: 'Shops, sims, DJs, designers. Follow the ones that matter to you.' },
          { n: '3', title: 'See only what fits', desc: 'Your feed only shows content that matches your interests. Nothing else gets through.' },
        ].map(step => (
          <div key={step.n} style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060d14', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>{step.n}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 3 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'cta',
    content: () => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${C.sky}55`, marginBottom: 24, fontSize: 36 }}>⚡</div>
        <h1 className="sg" style={{ fontSize: 36, fontWeight: 900, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 10 }}>InCynq</h1>
        <p style={{ fontSize: 18, color: C.sub, marginBottom: 8, fontWeight: 600 }}>Connect with what matters.</p>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Free for all Second Life residents.</p>
      </div>
    ),
  },
];

export default function OnboardingScreen({ onDone }) {
  const [slide, setSlide] = useState(0);

  const next = () => {
    if (slide < SLIDES.length - 1) setSlide(s => s + 1);
    else onDone();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>

      {/* Skip */}
      {slide < SLIDES.length - 1 && (
        <div style={{ padding: '16px 24px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onDone} style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Skip</button>
        </div>
      )}

      {/* Slide */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="fadeUp" key={slide}>
        {SLIDES[slide].content()}
      </div>

      {/* Footer */}
      <div style={{ padding: '0 24px 40px' }}>
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === slide ? 20 : 6, height: 6, borderRadius: 3,
              background: i === slide ? C.sky : C.border,
              transition: 'all .3s',
            }} />
          ))}
        </div>

        <button onClick={next} style={{
          width: '100%', padding: '15px', borderRadius: 16,
          background: `linear-gradient(135deg,${C.sky},${C.peach})`,
          color: '#060d14', fontWeight: 900, fontSize: 16,
          boxShadow: `0 0 30px ${C.sky}44`,
        }}>
          {slide < SLIDES.length - 1 ? "Let's go →" : "Get started →"}
        </button>
      </div>
    </div>
  );
}
