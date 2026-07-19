const TOKEN_KEY = 'ava_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function hasPersistentToken(): boolean {
  return localStorage.getItem(TOKEN_KEY) !== null;
}

export function storeToken(token: string, persistent: boolean): void {
  clearToken();
  (persistent ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
