"""
Utility helpers for extracting MediaPipe hand landmarks from official sign-language videos.

Usage:
    python process_landmarks.py --sign hello \
        --video http://sldict.korean.go.kr/.../MOV000257117_700X466.mp4

This will:
  * stream the video directly with OpenCV
  * run MediaPipe Hands on every frame
  * save raw frame-by-frame landmark coordinates
  * compute an average pose template for the requested sign
  * write results to backend/data/{sign}_landmarks.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import cv2
import mediapipe as mp
import numpy as np

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def extract_landmarks(video_url: str, max_frames: int | None = None) -> List[List[Dict[str, float]]]:
    cap = cv2.VideoCapture(video_url)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source: {video_url}")

    hands = mp.solutions.hands.Hands(
        max_num_hands=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    frames: List[List[Dict[str, float]]] = []
    frame_count = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            h, w, _ = frame.shape
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(rgb)

            if results.multi_hand_landmarks:
                frame_landmarks: List[Dict[str, float]] = []
                for idx, lm in enumerate(results.multi_hand_landmarks[0].landmark):
                    frame_landmarks.append({"id": idx, "x": lm.x, "y": lm.y, "z": lm.z})
                    cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 3, (0, 255, 0), -1)

                frames.append(frame_landmarks)

            frame_count += 1
            if max_frames and frame_count >= max_frames:
                break

            cv2.imshow("Sign capture preview", frame)
            if cv2.waitKey(10) & 0xFF == 27:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return frames


def average_landmarks(frames: List[List[Dict[str, float]]]) -> List[Dict[str, float]]:
    if not frames:
        return []

    num_points = len(frames[0])
    accum = np.zeros((num_points, 3), dtype=np.float64)

    for frame in frames:
        for point in frame:
            accum[point["id"]] += np.array([point["x"], point["y"], point["z"]])

    averages = []
    for idx in range(num_points):
        avg = accum[idx] / len(frames)
        averages.append({"id": idx, "x": float(avg[0]), "y": float(avg[1]), "z": float(avg[2])})
    return averages


def save_landmarks(sign: str, video_url: str, frames: List[List[Dict[str, float]]], averages: List[Dict[str, float]]) -> Path:
    payload = {
        "sign": sign,
        "alias": sign.lower(),
        "video": video_url,
        "frames_sampled": len(frames),
        "average": averages,
        "frames": frames[:50],  # keep sample subset to avoid huge files
    }

    out_path = DATA_DIR / f"{sign.lower()}_landmarks.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Extract MediaPipe hand landmarks from a sign-language dictionary video.")
    parser.add_argument("--sign", required=True, help="Sign label, e.g. hello")
    parser.add_argument("--video", required=True, help="Video URL to process")
    parser.add_argument("--max-frames", type=int, default=None, help="Optional frame limit for quicker experiments")
    args = parser.parse_args()

    frames = extract_landmarks(args.video, args.max_frames)
    if not frames:
        raise RuntimeError("No landmarks detected; check video URL or adjust detection thresholds.")

    averages = average_landmarks(frames)
    out_path = save_landmarks(args.sign, args.video, frames, averages)
    print(f"Saved landmark data to {out_path}")


if __name__ == "__main__":
    main()

