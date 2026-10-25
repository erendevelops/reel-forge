"""Face track: python face_track.py <video> <out.json> --fps 10 [--model tools/models/blaze_face_short_range.tflite]

Writes {"w", "h", "boxes": [{"t", "x", "y", "bw", "bh"}]}: w/h are the video's display size in pixels, box values
are normalised 0-1 (largest face per sampled frame; frames without a face are omitted), t is in seconds.

Uses the MediaPipe Tasks face detector. Its model is not committed; get it from
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
into tools/models/.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

ANALYSIS_W = 640
DEFAULT_MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "blaze_face_short_range.tflite")


def display_size(video: str) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", video],
        check=True, capture_output=True,
    ).stdout
    s = json.loads(out.decode("utf-8"))["streams"][0]
    w, h = int(s["width"]), int(s["height"])
    rot = 0
    for sd in s.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    if not rot and "rotate" in (s.get("tags") or {}):
        rot = int(s["tags"]["rotate"])
    return (h, w) if abs(rot) % 180 == 90 else (w, h)


def frames(video: str, fps: float, aw: int, ah: int):
    """Yields RGB frames at `fps`, autorotated (ffmpeg default) and scaled to aw x ah."""
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", video, "-an", "-vf", f"fps={fps},scale={aw}:{ah}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    size = aw * ah * 3
    try:
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            yield np.frombuffer(buf, dtype=np.uint8).reshape(ah, aw, 3)
    finally:
        p.stdout.close()
        if p.wait() != 0:
            raise RuntimeError("ffmpeg frame decode failed")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--fps", type=float, default=10)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    a = ap.parse_args()

    if not os.path.isfile(a.model):
        raise FileNotFoundError(f"face model not found: {a.model} (see the header of tools/face_track.py)")

    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions

    w, h = display_size(a.video)
    aw = min(ANALYSIS_W, w) // 2 * 2
    ah = max(2, round(aw * h / w / 2) * 2)

    # MediaPipe's native loader can't open non-ASCII paths (e.g. Masaüstü) on Windows: hand it the bytes instead.
    # The video is never opened natively either: ffmpeg (argv via CreateProcessW) decodes it into numpy frames.
    with open(a.model, "rb") as f:
        model_bytes = f.read()
    detector = FaceDetector.create_from_options(
        FaceDetectorOptions(base_options=BaseOptions(model_asset_buffer=model_bytes), min_detection_confidence=0.5)
    )
    boxes = []
    for i, rgb in enumerate(frames(a.video, a.fps, aw, ah)):
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        dets = detector.detect(img).detections
        if not dets:
            continue
        bb = max(dets, key=lambda d: d.bounding_box.width * d.bounding_box.height).bounding_box
        x0 = min(max(bb.origin_x / aw, 0.0), 1.0)
        y0 = min(max(bb.origin_y / ah, 0.0), 1.0)
        x1 = min(max((bb.origin_x + bb.width) / aw, 0.0), 1.0)
        y1 = min(max((bb.origin_y + bb.height) / ah, 0.0), 1.0)
        boxes.append({"t": round(i / a.fps, 4), "x": round(x0, 5), "y": round(y0, 5),
                      "bw": round(x1 - x0, 5), "bh": round(y1 - y0, 5)})

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"w": w, "h": h, "boxes": boxes}, f)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"face_track failed: {e}", file=sys.stderr)
        sys.exit(1)
