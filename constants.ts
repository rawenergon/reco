
export const APP_NAME = "Reco";

export const LOCAL_STORAGE_KEYS = {
  SUPABASE_URL: 'sentinel_sb_url',
  SUPABASE_KEY: 'sentinel_sb_key',
  GEMINI_KEY: 'sentinel_gemini_key', 
  EMPLOYEES: 'sentinel_mock_employees', 
  ATTENDANCE: 'sentinel_mock_attendance',
  CLOUDINARY_CLOUD_NAME: 'sentinel_cloud_name',
  CLOUDINARY_PRESET: 'sentinel_cloud_preset',
  CLOUDINARY_API_KEY: 'sentinel_cloud_key',
  CLOUDINARY_API_SECRET: 'sentinel_cloud_secret',
  CLOUDINARY_URL: 'sentinel_cloud_url',
  MOCK_SESSION: 'sentinel_mock_session'
};

// CONFIGURATION FROM ENVIRONMENT
// Real credentials come from the local .env file (VITE_* vars, git-ignored).
// Set the same vars on your hosting provider at deploy time.
// The repo intentionally contains NO secrets.
const env = (import.meta as any).env || {};
export const DEFAULT_CONFIG = {
  SUPABASE_URL: env.VITE_SUPABASE_URL || "",
  SUPABASE_KEY: env.VITE_SUPABASE_KEY || "",
  GEMINI_API_KEY: env.VITE_GEMINI_API_KEY || "",
  CLOUDINARY_CLOUD_NAME: env.VITE_CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_UPLOAD_PRESET: env.VITE_CLOUDINARY_UPLOAD_PRESET || "",
  CLOUDINARY_API_KEY: env.VITE_CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: env.VITE_CLOUDINARY_API_SECRET || "",
  CLOUDINARY_URL: env.VITE_CLOUDINARY_URL || ""
};
