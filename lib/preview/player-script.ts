/**
 * The live preview's player, served as `assets/player.js` next to a compiled plan (spec §8: "The preview updates live
 * in the browser (no MP4 render)"). HyperFrames' own runtime isn't there, so this does its job approximately: seek
 * the paused GSAP timeline, show each `.clip` only inside [data-start, data-start + data-duration), and keep media
 * clips at `t − data-start + data-media-start`. Driven by postMessage from the app: `{rf:'seek',t}`, `{rf:'play'}`,
 * `{rf:'pause'}`; answers `{rf:'time',t}` on every change.
 */
export const PLAYER_JS = `(function () {
  var tl = window.__timelines && window.__timelines.main;
  var root = document.getElementById('root');
  var duration = root ? Number(root.getAttribute('data-duration')) || 0 : 0;
  var t = 0, playing = false, t0 = 0, raf = 0;
  var num = function (el, k) { return Number(el.getAttribute('data-' + k)) || 0; };
  function sync(force) {
    var clips = document.querySelectorAll('.clip');
    for (var i = 0; i < clips.length; i++) {
      var el = clips[i], s = num(el, 'start'), d = num(el, 'duration');
      var inside = t >= s && t < s + d;
      el.style.visibility = inside ? 'visible' : 'hidden';
      if (el.tagName !== 'VIDEO' && el.tagName !== 'AUDIO') continue;
      if (el.hasAttribute('data-volume')) el.volume = Math.min(1, num(el, 'volume'));
      if (!inside) { if (!el.paused) el.pause(); continue; }
      var want = t - s + num(el, 'media-start');
      if (force || !playing || Math.abs(el.currentTime - want) > 0.15) el.currentTime = want;
      if (playing && el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
      if (!playing && !el.paused) el.pause();
    }
  }
  function post() { window.parent.postMessage({ rf: 'time', t: t }, '*'); }
  function seek(x, force) {
    t = Math.max(0, duration ? Math.min(x, duration) : x);
    if (tl) tl.seek(t, false);
    sync(force);
    post();
  }
  function frame() {
    if (!playing) return;
    var x = (performance.now() - t0) / 1000;
    if (duration && x >= duration) { playing = false; seek(duration, true); return; }
    seek(x, false);
    raf = requestAnimationFrame(frame);
  }
  window.addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.rf === 'seek') { seek(Number(m.t) || 0, true); if (playing) t0 = performance.now() - t * 1000; }
    if (m.rf === 'play' && !playing) { playing = true; t0 = performance.now() - t * 1000; sync(true); raf = requestAnimationFrame(frame); }
    if (m.rf === 'pause') { playing = false; cancelAnimationFrame(raf); sync(true); }
  });
  seek(0, true);
})();
`;
