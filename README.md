<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1n_nV2aExuI5M_BGBLng4DffnGCPpw3R0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional) Set `VITE_BACKEND_BASE_URL` to your FastAPI origin (defaults to `http://localhost:8000`).
4. Run the app:
   `npm run dev`

## Pose Detection Backend

The webcam pose recognition feature relies on a FastAPI service that uses MediaPipe and OpenCV.

1. Install Python requirements:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Start the API server:
   ```bash
   uvicorn backend.main:app --reload
   ```
3. (Optional) If you host it elsewhere, set `VITE_BACKEND_BASE_URL` and `VITE_POSE_API_URL` accordingly.

## Landmark Extraction & Dataset Tools

- `backend/process_landmarks.py`: Streams an official sign dictionary video, extracts MediaPipe hand landmarks frame-by-frame, and saves raw/average coordinates under `backend/data/*_landmarks.json`.
  ```bash
  python backend/process_landmarks.py --sign hello --video <VIDEO_URL>
  ```
- `backend/sign_classifier.py`: Provides a nearest-centroid classifier stub and a dataset exporter (`python backend/sign_classifier.py`) that merges landmark files into `sign_dataset.json` for model training.
- The FastAPI endpoint `GET /landmarks/<sign>` serves the averaged coordinates, which the React app overlays as guidance dots when the camera is off.

## Pose Detection Backend

The webcam pose recognition feature relies on a FastAPI service that uses MediaPipe and OpenCV.

1. Install Python requirements:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Start the API server:
   ```bash
   uvicorn main:app --reload
   ```
3. (Optional) If you host it elsewhere, set `VITE_POSE_API_URL` in `.env` to the deployed URL.
