import { clearToken, getToken } from './tokenStorage';

interface ErrorBody {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }
  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // Response body is not JSON.
    }
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message;
    throw new ApiError(message ?? '', response.status);
  }
  return response.json() as Promise<T>;
}
