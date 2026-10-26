'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import { RATIO_SIZE } from '@/lib/compile/types';
import type { Ratio } from '@/lib/plan/schema';

/**
 * The live preview: the compiled plan in an iframe, scaled to fit its box at the ratio's aspect, driven by the
 * player script over postMessage. `time`/`playing` are owned by the parent so scene clicks can seek it.
 */
export function PreviewPlayer({
  lang,
  src,
  ratio,
  duration,
  time,
  playing,
  onTime,
  onPlaying,
  seek,
}: {
  lang: Language;
  src: string | null;
  ratio: Ratio;
  duration: number;
  time: number;
  playing: boolean;
  onTime: (t: number) => void;
  onPlaying: (p: boolean) => void;
  /** A seek the parent asks for (a scene click); `n` makes repeated seeks to the same time distinct. */
  seek?: { t: number; n: number };
}) {
  const d = t(lang).preview;
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const [w, h] = RATIO_SIZE[ratio];
  const send = (m: object) => frame.current?.contentWindow?.postMessage(m, '*');

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.rf === 'time') onTime(Number(e.data.t));
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onTime]);

  useEffect(() => {
    if (seek) frame.current?.contentWindow?.postMessage({ rf: 'seek', t: seek.t }, '*');
  }, [seek]);

  function toggle() {
    const next = !playing;
    send({ rf: next ? 'play' : 'pause' });
    onPlaying(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="preview-box" style={{ aspectRatio: `${w} / ${h}` }}>
        {src ? (
          <iframe
            ref={frame}
            src={src}
            title="preview"
            sandbox="allow-scripts"
            onLoad={() => send({ rf: 'seek', t: time })}
            style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }}
          />
        ) : (
          <div className="meta grid h-full place-items-center">{d.building}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn" onClick={toggle} aria-label={playing ? d.pause : d.play}>
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          className="flex-1"
          min={0}
          max={duration}
          step={0.01}
          value={time}
          onChange={(e) => {
            const x = Number(e.target.value);
            send({ rf: 'seek', t: x });
            onTime(x);
          }}
        />
        <span className="meta font-mono">{time.toFixed(1)} s</span>
      </div>
    </div>
  );
}
