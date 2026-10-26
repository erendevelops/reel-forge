import type { ReactNode } from 'react';

/** Looping CSS previews per tile (the approved mockup's keyframes: w, roll, tick, bar, pop, stamp; 2.4 s loop). */
const A = (name: string, style: React.CSSProperties = {}) => ({ className: 'a', style: { animationName: name, ...style } });

export const PREVIEWS: Record<string, ReactNode> = {
  'word-build': <span style={{ font: '800 13px var(--font-body)' }}>bedava <span {...A('w', { color: '#d4a800' })}>araç</span></span>,
  'one-word': <span {...A('w', { font: '800 18px var(--font-body)', color: '#FFD21F', WebkitTextStroke: '1px #333' })}>Devlet</span>,
  'serif-small': <span style={{ font: '400 14px Georgia, serif' }}>işi <i>masaya</i></span>,
  none: <span style={{ color: '#9CA3AF' }}>—</span>,
  'full-face': <div className="pv-phone" style={{ background: '#9aa8a1' }} />,
  split: (
    <div className="pv-phone" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 3 }}>
      <div style={{ flex: 1, background: '#E8ECEA', borderRadius: 2 }} />
      <div style={{ flex: 1, background: '#9aa8a1', borderRadius: 2 }} />
    </div>
  ),
  'full-graphics': (
    <div className="pv-phone" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 24, height: 12, background: '#E8ECEA', borderRadius: 2 }} />
    </div>
  ),
  broll: (
    <div className="pv-phone" style={{ background: '#9aa8a1', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 'auto 3px 5px 3px', height: 18, background: '#d3dcd7', borderRadius: 2 }} />
    </div>
  ),
  'rolling-number': (
    <div style={{ height: 20, overflow: 'hidden', font: '800 14px var(--font-body)' }}>
      <div {...A('roll')}>999.244 ₺<br />999.871 ₺<br />1.000.000 ₺<br />1.000.000 ₺</div>
    </div>
  ),
  checklist: (
    <div className="pv-chip">Google <span {...A('tick', { width: 12, height: 12, borderRadius: '50%', background: '#1F9D6E', color: '#fff', fontSize: 8, display: 'grid', placeItems: 'center' })}>✓</span></div>
  ),
  'bar-chart': (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 50 }}>
      <div style={{ width: 14, height: 22, background: '#e5e0d5', borderRadius: 3 }} />
      <div {...A('bar', { width: 14, background: '#F5B700', borderRadius: 3 })} />
    </div>
  ),
  stamp: <span {...A('stamp', { font: '800 12px var(--font-body)', color: '#1F9D6E', border: '2px solid #1F9D6E', padding: '2px 6px', borderRadius: 5, background: '#fff' })}>%70 GERİ</span>,
  'logo-pop': <div {...A('pop', { width: 38, height: 38, borderRadius: 9, background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,.18)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#1F9D6E' })}>G</div>,
  'numbered-list': <div style={{ font: '800 11px var(--font-body)', lineHeight: 1.5 }}><div>1. Fooocus</div><div style={{ color: '#d4a800' }}>2. Whisper</div></div>,
  'typed-title': <span style={{ font: '800 13px var(--font-body)' }}>Dijital<span {...A('w')}>|</span></span>,
  'title-card': <span style={{ font: '900 13px var(--font-body)' }}><span style={{ background: '#FFD21F', borderRadius: 4, padding: '0 4px', marginRight: 4 }}>1</span>Fooocus</span>,
  'follow-outro': <span style={{ background: '#0095F6', color: '#fff', font: '700 10px var(--font-body)', padding: '4px 10px', borderRadius: 6 }}>Takip Et</span>,
  topicAssets: <div {...A('pop', { width: 34, height: 34, borderRadius: 8, background: '#111', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16 })}>✳</div>,
  'custom-animation': (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span {...A('pop', { width: 14, height: 14, borderRadius: '50%', background: '#1F9D6E' })} />
      <span style={{ width: 18, borderTop: '2px dashed #9CA3AF' }} />
      <span {...A('tick', { width: 14, height: 14, borderRadius: 4, background: '#F5B700' })} />
    </div>
  ),
  sfx: <span className="font-mono" style={{ fontSize: 12 }}>♪ pop</span>,
  music: <span className="font-mono" style={{ fontSize: 12 }}>▁▂▅▇▅▂▁</span>,
  punchIns: <span className="font-mono" style={{ fontSize: 12 }}>⊕ 1.08×</span>,
  thumbnail: <div className="pv-phone" style={{ background: '#9aa8a1', display: 'grid', placeItems: 'center', font: '900 7px var(--font-body)', color: '#FFD21F' }}>ÜCRETSİZ</div>,
};
