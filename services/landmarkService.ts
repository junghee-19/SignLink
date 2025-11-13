const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:8000';

export interface LandmarkPoint {
  id: number;
  x: number;
  y: number;
  z?: number;
}

export interface LandmarkResponse {
  sign: string;
  alias?: string;
  video?: string;
  average: LandmarkPoint[];
}

export async function fetchLandmarks(sign: string): Promise<LandmarkResponse> {
  const response = await fetch(`${API_BASE}/landmarks/${sign}`);
  if (!response.ok) {
    throw new Error(`Failed to load landmarks for ${sign}`);
  }
  return response.json();
}

