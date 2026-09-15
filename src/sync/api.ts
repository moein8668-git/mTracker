export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, { method, body, token }: { method?: string; body?: unknown; token?: string | null }): Promise<T> {
  const url = API_BASE + path;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const res = await fetch(url, { method: method || 'GET', headers, body: body ? JSON.stringify(body) : undefined });

  if (res.status === 401) {
    localStorage.removeItem('mtracker.auth');
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || 'Error');
  }

  return res.json();
}
