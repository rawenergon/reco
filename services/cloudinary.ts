
import { DEFAULT_CONFIG, LOCAL_STORAGE_KEYS } from '../constants';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
}

/**
 * Parses a Cloudinary connection URL in the form:
 *   cloudinary://<api_key>:<api_secret>@<cloud_name>
 * Returns null if the URL is missing or malformed.
 */
export const parseCloudinaryURL = (url?: string | null): { cloudName: string; apiKey: string; apiSecret: string } | null => {
  if (!url) return null;
  try {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (!match) return null;
    const [, apiKey, apiSecret, cloudName] = match;
    if (!cloudName) return null;
    return { cloudName, apiKey: decodeURIComponent(apiKey), apiSecret: decodeURIComponent(apiSecret) };
  } catch {
    return null;
  }
};

/**
 * Resolves the effective Cloudinary configuration.
 * Precedence: localStorage overrides -> Vite env vars -> parsed CLOUDINARY_URL -> hardcoded defaults.
 */
export const getCloudinaryConfig = (): CloudinaryConfig => {
  const env = (import.meta as any).env || {};

  const urlConfig = parseCloudinaryURL(
    localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_URL) ||
    env.VITE_CLOUDINARY_URL ||
    DEFAULT_CONFIG.CLOUDINARY_URL
  );

  return {
    cloudName: localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_CLOUD_NAME) ||
      env.VITE_CLOUDINARY_CLOUD_NAME ||
      urlConfig?.cloudName ||
      DEFAULT_CONFIG.CLOUDINARY_CLOUD_NAME ||
      "",
    uploadPreset: localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_PRESET) ||
      env.VITE_CLOUDINARY_UPLOAD_PRESET ||
      DEFAULT_CONFIG.CLOUDINARY_UPLOAD_PRESET ||
      null,
    apiKey: localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_KEY) ||
      env.VITE_CLOUDINARY_API_KEY ||
      urlConfig?.apiKey ||
      DEFAULT_CONFIG.CLOUDINARY_API_KEY ||
      null,
    apiSecret: localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_SECRET) ||
      env.VITE_CLOUDINARY_API_SECRET ||
      urlConfig?.apiSecret ||
      DEFAULT_CONFIG.CLOUDINARY_API_SECRET ||
      null,
  };
};

/**
 * Generates a SHA-1 signature for Cloudinary signed uploads using Web Crypto API.
 */
const generateSignature = async (params: Record<string, string>, apiSecret: string): Promise<string> => {
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = sortedKeys.map(key => `${key}=${params[key]}`).join('&') + apiSecret;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Uploads a base64 image to Cloudinary.
 * Supports both Unsigned Presets and Signed Uploads (using API Key/Secret).
 */
export const uploadToCloudinary = async (
  base64Data: string, 
  cloudName: string, 
  uploadPreset?: string | null,
  apiKey?: string | null,
  apiSecret?: string | null
): Promise<string> => {
  try {
    if (!cloudName) throw new Error("Missing Cloudinary Cloud Name.");

    // 1. Convert Base64 to Blob
    const res = await fetch(base64Data);
    const blob = await res.blob();

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append('file', blob);

    // 3. Determine Upload Method
    if (apiKey && apiSecret) {
      // METHOD A: SIGNED UPLOAD (Uses API Key + Secret)
      const timestamp = Math.round((new Date()).getTime() / 1000).toString();
      formData.append('timestamp', timestamp);
      formData.append('api_key', apiKey);
      
      // Generate Signature
      const signature = await generateSignature({ timestamp }, apiSecret);
      formData.append('signature', signature);
      
    } else if (uploadPreset) {
      // METHOD B: UNSIGNED UPLOAD (Uses Preset)
      formData.append('upload_preset', uploadPreset);
    } else {
      throw new Error("Missing configuration: Provide either an Upload Preset OR API Key & Secret.");
    }

    // 4. Upload to Cloudinary API
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Cloudinary upload failed');
    }

    const data = await response.json();
    return data.secure_url; // Returns the HTTPS URL of the uploaded image
  } catch (error: any) {
    console.error("Cloudinary Upload Error:", error);
    throw new Error(`Cloudinary Upload Failed: ${error.message}`);
  }
};

/**
 * Extracts the Cloudinary public_id from an uploaded image URL.
 * Example: https://res.cloudinary.com/<cloud>/image/upload/v1234/abc.jpg -> abc
 */
const extractPublicId = (photoUrl: string): string | null => {
  try {
    const url = new URL(photoUrl);
    if (!url.pathname.includes('/image/upload/')) return null;
    let publicId = url.pathname.split('/image/upload/')[1];
    publicId = publicId.replace(/^v\d+\//, '');
    publicId = publicId.replace(/\.[^.]+$/, '');
    return publicId || null;
  } catch {
    return null;
  }
};

/**
 * Deletes an uploaded image from Cloudinary (signed destroy request).
 * Silently resolves if the image is not on Cloudinary or deletion fails.
 */
export const destroyCloudinaryImage = async (
  photoUrl: string | undefined,
  cloudName: string,
  apiKey?: string | null,
  apiSecret?: string | null
): Promise<void> => {
  if (!photoUrl || !apiKey || !apiSecret) return;

  const publicId = extractPublicId(photoUrl);
  if (!publicId) return;

  try {
    const timestamp = Math.round((new Date()).getTime() / 1000).toString();
    const signature = await generateSignature({ timestamp, public_id: publicId }, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn("Cloudinary destroy warning:", err.error?.message || `HTTP ${response.status}`);
    }
  } catch (error: any) {
    console.warn("Failed to delete Cloudinary image:", error.message);
  }
};
