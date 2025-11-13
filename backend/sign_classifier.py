"""
Lightweight utilities for building a simple nearest-centroid classifier
based on averaged MediaPipe hand landmarks. This is not meant to replace
a proper ML pipeline, but gives a quick baseline for experimentation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from math import sqrt

DATA_DIR = Path(__file__).parent / "data"


def load_templates() -> Dict[str, List[Dict[str, float]]]:
    templates: Dict[str, List[Dict[str, float]]] = {}
    for json_file in DATA_DIR.glob("*_landmarks.json"):
        with json_file.open(encoding="utf-8") as f:
            payload = json.load(f)
            alias = payload.get("alias") or payload.get("sign")
            templates[alias.lower()] = payload.get("average", [])
    return templates


def euclidean_distance(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    return sqrt((p1["x"] - p2["x"]) ** 2 + (p1["y"] - p2["y"]) ** 2 + (p1.get("z", 0.0) - p2.get("z", 0.0)) ** 2)


def classify(landmarks: List[Dict[str, float]]) -> str | None:
    templates = load_templates()
    if not templates or not landmarks:
        return None

    best_label = None
    best_score = float("inf")

    for label, template in templates.items():
        if len(template) != len(landmarks):
            continue
        score = sum(euclidean_distance(landmarks[i], template[i]) for i in range(len(template))) / len(template)
        if score < best_score:
            best_score = score
            best_label = label

    return best_label


def export_dataset(out_path: Path, limit_frames: int | None = None) -> None:
    """
    Merge all *_landmarks.json files into a single dataset file that can
    be used for external training.
    """
    rows = []
    for json_file in DATA_DIR.glob("*_landmarks.json"):
        with json_file.open(encoding="utf-8") as f:
            payload = json.load(f)
            alias = payload.get("alias") or payload.get("sign")
            frames = payload.get("frames", [])
            if limit_frames:
                frames = frames[:limit_frames]
            for frame in frames:
                row = {"label": alias}
                for point in frame:
                    row[f"x_{point['id']}"] = point["x"]
                    row[f"y_{point['id']}"] = point["y"]
                    row[f"z_{point['id']}"] = point.get("z", 0.0)
                rows.append(row)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"Exported {len(rows)} samples to {out_path}")


if __name__ == "__main__":
    dataset_file = Path("sign_dataset.json")
    export_dataset(dataset_file, limit_frames=100)
