"""Word-level transcription: python transcribe.py <audio> <out.json> --lang tr|en|auto --model small --prompt "..." """
import argparse
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np


def decode(audio: str, wav_path: str) -> np.ndarray:
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", audio, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path],
        check=True,
    )
    with wave.open(wav_path, "rb") as w:
        frames = w.readframes(w.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--lang", default="auto")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--prompt", default=None)
    a = ap.parse_args()

    from faster_whisper import WhisperModel

    with tempfile.TemporaryDirectory() as td:
        samples = decode(a.audio, os.path.join(td, "audio16k.wav"))

    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        samples,
        language=None if a.lang == "auto" else a.lang,
        word_timestamps=True,
        initial_prompt=a.prompt or None,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"w": w.word.strip(), "start": float(w.start), "end": float(w.end)})
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"language": info.language, "words": words}, f, ensure_ascii=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"transcribe failed: {e}", file=sys.stderr)
        sys.exit(1)
