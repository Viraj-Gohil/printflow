/**
 * Frontend API Base URL Configuration Helper
 *
 * Requirements:
 * - When frontend and backend run on the same domain or use a reverse proxy (local dev or unified container),
 *   defaults to relative path (empty string '') so requests go to /api/...
 * - When frontend is hosted on Vercel and backend is hosted on a separate container service (e.g. Render/Railway),
 *   VITE_API_BASE_URL (e.g. 'https://printflow-api.onrender.com') is prepended.
 * - This allows large document uploads to stream directly from the browser to the backend container,
 *   completely bypassing Vercel Serverless Function 4.5 MB body size limits.
 */

export function getApiBaseUrl(): string {
  try {
    const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/$/, '');
    }
  } catch {
    // Non-Vite or node environments
  }
  return '';
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${getApiBaseUrl()}${cleanEndpoint}`;
}

