from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import base64
import cv2
import numpy as np
from mediapipe import solutions as mp
from pathlib import Path
import json

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_pose = mp.pose.Pose()

DATA_DIR = Path(__file__).parent / "data"
SIGN_LANDMARKS = {}


def load_landmark_templates():
    for json_file in DATA_DIR.glob("*_landmarks.json"):
        with json_file.open(encoding="utf-8") as f:
            payload = json.load(f)
            alias = payload.get("alias") or payload.get("sign")
            SIGN_LANDMARKS[alias.lower()] = payload


def detect_gestures(landmarks):
    """Return a simple string based on wrist positions."""
    nose_y = landmarks[mp.pose.PoseLandmark.NOSE].y
    left_wrist = landmarks[mp.pose.PoseLandmark.LEFT_WRIST]
    right_wrist = landmarks[mp.pose.PoseLandmark.RIGHT_WRIST]

    # Allow small margin above/below nose and lower the visibility constraint to make detection easier.
    margin = 0.15  # allow larger vertical tolerance
    visibility_threshold = 0.2  # accept lower visibility

    left_up = (left_wrist.y < nose_y + margin) and (left_wrist.visibility > visibility_threshold)
    right_up = (right_wrist.y < nose_y + margin) and (right_wrist.visibility > visibility_threshold)

    if left_up and right_up:
        return "양손을 들어 환영 인사를 하고 있어요."
    if left_up:
        return "왼손을 들어 인사했어요."
    if right_up:
        return "오른손을 들어 인사했어요."

    return None


@app.post("/predict")
async def predict(request: Request):
    body = await request.json()
    img_data = base64.b64decode(body["image"])
    np_arr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    results = mp_pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if results.pose_landmarks:
        message = detect_gestures(results.pose_landmarks.landmark)
        if message:
            return {"text": message}
        return {"text": "안녕하세요 배부르네요"}

    return {"text": "안녕하세요 배부르네요"}


@app.get("/landmarks/{sign}")
async def get_sign_landmarks(sign: str):
    if not SIGN_LANDMARKS:
        load_landmark_templates()
    payload = SIGN_LANDMARKS.get(sign.lower())
    if not payload:
        raise HTTPException(status_code=404, detail="Sign landmarks not found.")
    return payload
