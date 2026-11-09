/**
 * `mo`, the motion kit of a scene script: spring easing, one shape that morphs between states, blur content swaps, a
 * cursor that moves and clicks, a camera that pushes in, a liquid indicator and a stroke icon set. Everything is
 * written into the seekable timeline (tweens and per-frame sets), never callbacks, so any frame renders on its own.
 *
 * Adapted from Bart's motion-broll engine (github.com/Barty-Bart/motion-graphics, MIT); icon paths from Lucide (ISC).
 * Runs inside `scriptRuntime` where `T` (the card-relative timeline), `$$`, `stage`, `W`, `H` and `FPS` exist.
 */
export const MOTION_KIT_JS = String.raw`
const mo = (function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  // closed-form spring step response 0 → 1 (zero initial velocity)
  const S = (tau, w, z) => {
    if (tau <= 0) return 0;
    if (z < 1) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau)); }
    if (z > 1 + 1e-6) { const q = w * Math.sqrt(z * z - 1), r1 = -z * w + q, r2 = -z * w - q; return 1 - (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r2 - r1); }
    return 1 - Math.exp(-w * tau) * (1 + w * tau);
  };
  const SPRINGS = { morph: [15, 0.84], fast: [27, 0.86], slow: [12.5, 0.9], soft: [10, 0.95], cam: [7.5, 1], pop: [13, 0.78], snap: [45, 1] };
  const spec = (name) => { const s = SPRINGS[name || 'morph']; if (!s) throw new Error('unknown spring ' + name + ' (' + Object.keys(SPRINGS).join(', ') + ')'); return s; };
  // settle time: the envelope under 0.2 %
  const settle = (name) => { const [w, z] = spec(name); return Math.min(2.5, (z >= 1 ? 8.6 / w : Math.log(500) / (z * w))); };
  const ease = (name) => { const [w, z] = spec(name), d = settle(name), end = S(d, w, z); return (u) => (u >= 1 ? 1 : S(u * d, w, z) / end); };
  const eio = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  /** tl.to with a spring: the duration is the spring's settle time. */
  const spring = (t, vars, at, name) => T.to(t, Object.assign({ ease: ease(name), duration: settle(name) }, vars), at);

  /** Content enters: waits a beat, then sharpens out of a blur (the old content has already left). */
  const show = (t, at, o) => {
    o = o || {};
    T.fromTo(t, { autoAlpha: 0, filter: 'blur(' + (o.blur || 12) + 'px)', scale: 0.94 }, { autoAlpha: 1, filter: 'blur(0px)', scale: 1, duration: o.dur || 0.26, ease: eo }, at + (o.delay === undefined ? 0.07 : o.delay));
  };
  /** Content leaves fast into a blur. */
  const hide = (t, at, o) => {
    o = o || {};
    T.to(t, { autoAlpha: 0, filter: 'blur(' + ((o.blur || 12) * 0.8) + 'px)', scale: 0.97, duration: o.dur || 0.12, ease: eo }, at);
  };
  /** One content swap: 'from' blurs out, 'to' blurs in a beat later, so they never overlap. */
  const swap = (from, to, at, o) => { if (from) hide(from, at, o); if (to) show(to, at, o); };

  /**
   * One shape that never cuts: 'states' = { name: { w, h, r, bg } }, 'seq' = [[at, name], …]. The element is centred
   * on (x, y) (default: stage centre) and springs its size and corners to each state; colour eases without overshoot.
   */
  const shape = (t, states, start, seq, o) => {
    o = o || {};
    const s0 = states[start];
    if (!s0) throw new Error('mo.shape: no state ' + start);
    T.set(t, { position: 'absolute', left: o.x === undefined ? W / 2 : o.x, top: o.y === undefined ? H / 2 : o.y, xPercent: -50, yPercent: -50, width: s0.w, height: s0.h, borderRadius: s0.r || 0, backgroundColor: s0.bg || 'transparent' }, 0);
    for (const [at, name] of seq || []) {
      const s = states[name];
      if (!s) throw new Error('mo.shape: no state ' + name);
      spring(t, { width: s.w, height: s.h, borderRadius: s.r || 0 }, at, o.spring || 'morph');
      if (s.bg) T.to(t, { backgroundColor: s.bg, duration: 0.35, ease: eo }, at);
    }
  };

  /** A button press: the element dips and springs back (pair it with a cursor click at the same time). */
  const press = (t, at) => { T.to(t, { scale: 0.965, duration: 0.07, ease: 'power2.out' }, at - 0.07); spring(t, { scale: 1 }, at, 'pop'); };

  /** Pops in from small with a slight overshoot. */
  const pop = (t, at) => { T.fromTo(t, { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, ease: ease('pop'), duration: settle('pop') }, at); };

  /**
   * The camera: 'world' holds the whole scene; keys [[at, scale, fx, fy]] put stage point (fx, fy) in the centre at
   * that zoom, on a critically damped spring (no overshoot). Push in so each state fills the frame.
   */
  const camera = (world, keys) => {
    const k0 = keys[0];
    const place = (k) => ({ scale: k[1], x: W / 2 - k[1] * (k[2] === undefined ? W / 2 : k[2]), y: H / 2 - k[1] * (k[3] === undefined ? H / 2 : k[3]) });
    T.set(world, Object.assign({ transformOrigin: '0px 0px', position: 'absolute', left: 0, top: 0, width: W, height: H }, place(k0)), 0);
    for (const k of keys.slice(1)) spring(world, place(k), k[0], 'cam');
  };

  /**
   * A cursor: keys [[at, x, y], …] in stage px (inside 'parent', default the stage, so it rides the camera), eased
   * between keys with a slight human arc; 'clicks' [at…] dip it; 'drags' [[from, to]…] hold it down.
   */
  const cursor = (keys, o) => {
    o = o || {};
    const size = o.size || 46;
    const el = document.createElement('div');
    el.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path d="M4 2.5 L4 19 L8.6 14.9 L11.5 21.2 L14.4 19.9 L11.6 13.7 L17.8 13.4 Z" fill="' + (o.color || '#111111') + '" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    el.style.cssText = 'position:absolute;left:0;top:0;width:' + size + 'px;height:' + size + 'px;z-index:50;pointer-events:none;transform-origin:4px 3px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.25))';
    ($$(o.parent || stage)[0] || stage).appendChild(el);
    const at0 = keys[0][0], at1 = keys[keys.length - 1][0];
    const pos = (t) => {
      if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
      let i = 0;
      while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
      const [t0, x0, y0] = keys[i], [t1, x1, y1] = keys[i + 1];
      const u = eio((t - t0) / (t1 - t0)), dx = x1 - x0, dy = y1 - y0, arc = Math.sin(Math.PI * u) * 0.06;
      return [x0 + dx * u - dy * arc, y0 + dy * u + dx * arc];
    };
    const n = Math.max(1, Math.round((at1 - at0) * FPS));
    for (let i = 0; i <= n; i++) { const t = at0 + (i * (at1 - at0)) / n, p = pos(t); T.set(el, { x: p[0] - 4, y: p[1] - 3 }, t); }
    T.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, Math.max(0, at0 - 0.15));
    for (const c of o.clicks || []) { T.to(el, { scale: 0.87, duration: 0.07, ease: 'power2.out' }, c - 0.07); spring(el, { scale: 1 }, c + 0.035, 'pop'); }
    for (const [a, b] of o.drags || []) { T.to(el, { scale: 0.87, duration: 0.05 }, a - 0.05); spring(el, { scale: 1 }, b, 'pop'); }
    if (o.out !== undefined) T.to(el, { autoAlpha: 0, duration: 0.2 }, o.out);
    return el;
  };

  /**
   * A liquid indicator (a highlight that moves between tabs, levels or rows): keys [[at, left, width], …] in its
   * parent's px. The edge moving forward rides a fast spring, the trailing edge a slow one, so it stretches.
   */
  const indicator = (t, keys) => {
    T.set(t, { position: 'absolute', left: keys[0][1], width: keys[0][2] }, 0);
    for (let i = 1; i < keys.length; i++) {
      const [at, l, w] = keys[i], fwd = l > keys[i - 1][1];
      spring(t, { left: l }, at, fwd ? 'slow' : 'fast');
      spring(t, { width: w }, at + (fwd ? 0 : 0.02), fwd ? 'fast' : 'slow');
    }
  };

  // one icon set on a 24 grid, stroke normalised so every icon has the same visual weight (Lucide, ISC)
  const IC = {
    arrow: ['M5 12h14', 'M13 5l7 7-7 7'], check: ['M20 6 9 17l-5-5'], x: ['M18 6 6 18', 'M6 6l12 12'], plus: ['M5 12h14', 'M12 5v14'],
    folder: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'],
    terminal: ['m4 17 6-6-6-6', 'M12 19h8'], file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M8 13h8', 'M8 17h5'],
    pencil: ['M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z', 'm15 5 4 4'],
    coin: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 18V6'],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
    chip: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 14h3', 'M1 9h3', 'M1 14h3'],
    sparkle: ['M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.3-4.3'],
    play: ['M6 3l14 9-14 9V3Z'], send: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7Z'], image: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'm21 15-5-5L5 21'],
    video: ['M15 10l5-3v10l-5-3', 'M3 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'], mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
    user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'], heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
    bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8Z'], chart: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'], lock: ['M5 11h14v10H5Z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'], settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z'],
  };
  /** An icon as SVG markup: 'el.innerHTML = mo.icon('check', 40, kit.accent)'. */
  const icon = (name, size, color, sw) => {
    const d = IC[name];
    if (!d) throw new Error('mo.icon: no icon ' + name + ' (' + Object.keys(IC).join(', ') + ')');
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="' + (((sw || 2.2) * 24) / size).toFixed(3) + '" stroke-linecap="round" stroke-linejoin="round">' + d.map((p) => '<path d="' + p + '"/>').join('') + '</svg>';
  };

  return { ease, settle, spring, show, hide, swap, shape, press, pop, camera, cursor, indicator, icon, icons: Object.keys(IC) };
})();
`;
