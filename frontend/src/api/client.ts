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

function filenameFromContentDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const plainMatch = /filename="?([^";]+)"?/i.exec(value);
  return plainMatch?.[1];
}

/** Для скачивания бинарных файлов (сгенерированные документы) — не JSON-ответ. */
export async function apiDownload(
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const headers = new Headers(options.headers);
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
    const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    throw new ApiError(message ?? '', response.status);
  }
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? 'document';
  return { blob, filename };
}

/** Скачивает Blob в браузере под указанным именем файла. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
