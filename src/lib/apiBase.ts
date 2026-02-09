const rawBase = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE = rawBase && rawBase.length > 0 ? rawBase.replace(/\/$/, "") : "/api";

export function withApiBase(path: string) {
  if (!path) {
    return API_BASE;
  }
  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}/${path}`;
}
