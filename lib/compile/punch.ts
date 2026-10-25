/**
 * Soft punch-in (reel doc §7.3, v5 Reel.tsx ShotLayer): `scale = 1 + spring({ damping: 40, stiffness: 120 }) × 0.08`,
 * the spring starting at the shot's `punch` time. One definition, shared by the HTML footage layer (GSAP ease)
 * and the layered path's ffmpeg base track (scale expression).
 *
 * The time curve is Remotion's, not textbook physics: `remotion/dist/cjs/spring/spring-utils.js` has only an
 * under-damped and a critically-damped branch, and uses the critically-damped one whenever ζ ≥ 1. With
 * ζ = 40 / (2·√120) ≈ 1.83 that gives x(t) = 1 − e^(−ω·t)·(1 + ω·t), ω = √(k/m) = √120 ≈ 10.954 /s
 * (checked against `spring()` from v5's node_modules: 0.299 @ 0.1 s, 0.758 @ 0.25 s, 0.968 @ 0.48 s).
 */
export const PUNCH = { amount: 0.08, damping: 40, stiffness: 120, mass: 1 } as const;

/** ω (1/s) of Remotion's critically-damped branch. */
export const PUNCH_OMEGA = Math.sqrt(PUNCH.stiffness / PUNCH.mass);

/** Spring progress 0 → 1 at `t` seconds after the punch starts (0 before). */
export function punchSpring(t: number): number {
  if (t <= 0) return 0;
  const wt = PUNCH_OMEGA * t;
  return 1 - Math.exp(-wt) * (1 + wt);
}

/** Residual (1 − progress) below which the spring counts as settled: 0.08 × 1e-3 = 0.00008 scale, ≈ 0.1 px. */
export const PUNCH_SETTLE_EPS = 1e-3;

/**
 * Settle time (s): first t with 1 − x(t) < PUNCH_SETTLE_EPS, by bisection on the monotone residual. ≈ 0.845 s,
 * matching Remotion's `measureSpring({ threshold: 0.001 })` = 51 frames at 60 fps (41 frames at its default 0.005).
 */
export const PUNCH_SETTLE = (() => {
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (1 - punchSpring(mid) < PUNCH_SETTLE_EPS) hi = mid;
    else lo = mid;
  }
  return hi;
})();

const f6 = (x: number) => Number(x.toFixed(6)).toString();
const W = f6(PUNCH_OMEGA);

/**
 * JS source of a GSAP ease factory for the page: `punchEase(d)` maps tween progress p ∈ [0,1] over a tween of `d`
 * seconds to spring progress at p·d. Not normalised, so a tween cut short by the shot end stops exactly where v5's
 * spring is at that moment (GSAP renders ease(1) as is; it does not force 1).
 */
export function punchEaseJs(): string {
  return `function punchEase(d) { return function (p) { var x = ${W} * p * d; return 1 - Math.exp(-x) * (1 + x); }; }`;
}

/** ffmpeg expression for the scale factor at stream time `t`, the punch starting `offset` seconds into the shot. */
export function punchScaleExpr(offset: number): string {
  const x = `(${W}*max(t-${f6(offset)},0))`;
  return `(1+${f6(PUNCH.amount)}*(1-exp(-${x})*(1+${x})))`;
}
