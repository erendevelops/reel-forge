"""Beat grid of a music file: tempo, beat times and the drop (prao doc §7: onset autocorrelation, phase fold, loudness jump).

Usage: python tools/beats.py <audio> <out.json>
Writes {"bpm": float, "beats": [s, ...], "drop": s | null}.
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 22050
HOP = 512


def load(path: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(wav)], check=True)
        with wave.open(str(wav)) as w:
            return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def onset_strength(x: np.ndarray) -> np.ndarray:
    frames = len(x) // HOP
    energy = np.array([np.sum(x[i * HOP:(i + 1) * HOP] ** 2) for i in range(frames)])
    flux = np.maximum(0, np.diff(np.log1p(energy * 1000), prepend=0))
    return flux - flux.mean()


def tempo(onset: np.ndarray) -> float:
    fps = SR / HOP
    ac = np.correlate(onset, onset, mode="full")[len(onset) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)  # 70–180 BPM
    lag = lo + int(np.argmax(ac[lo:hi]))
    return 60 * fps / lag


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    x = load(src)
    onset = onset_strength(x)
    fps = SR / HOP
    bpm = tempo(onset)
    period = 60 / bpm
    # Beat phase: fold onset strength onto one period and take the strongest offset.
    times = np.arange(len(onset)) / fps
    bins = 64
    fold = np.zeros(bins)
    for t, v in zip(times, onset):
        fold[int((t % period) / period * bins) % bins] += max(v, 0)
    phase = np.argmax(fold) / bins * period
    duration = len(x) / SR
    beats = [round(float(b), 3) for b in np.arange(phase, duration, period)]
    # Drop: the largest rise of 1 s loudness over the previous 2 s, ignoring the first 2 s.
    sec = np.array([np.sqrt(np.mean(x[i * SR:(i + 1) * SR] ** 2) + 1e-12) for i in range(int(duration))])
    drop = None
    if len(sec) > 4:
        rise = [sec[i] - sec[i - 2:i].mean() for i in range(2, len(sec))]
        i = int(np.argmax(rise)) + 2
        if rise[i - 2] > 0.5 * sec.mean():
            drop = round(float(min(beats, key=lambda b: abs(b - i))), 3)
    Path(out).write_text(json.dumps({"bpm": round(bpm, 2), "beats": beats, "drop": drop}), encoding="utf-8")


if __name__ == "__main__":
    main()
