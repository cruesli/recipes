// Minimal Netlify Identity (GoTrue) client for the annotate mode. Tokens live
// in localStorage; refresh happens on demand. Gated by PUBLIC_ANNOTATE_ORIGIN.

const ORIGIN: string | null = import.meta.env.PUBLIC_ANNOTATE_ORIGIN ?? null;
const KEY = 'recipes:identity';

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export const annotateEnabled = (): boolean => ORIGIN !== null;

function load(): TokenSet | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch { return null; }
}

function save(t: TokenSet | null) {
  if (t) localStorage.setItem(KEY, JSON.stringify(t));
  else localStorage.removeItem(KEY);
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(`${ORIGIN}/.netlify/identity/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`identity ${res.status}`);
  const data = await res.json();
  const t: TokenSet = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  save(t);
  return t;
}

export async function login(email: string, password: string): Promise<void> {
  await tokenRequest(new URLSearchParams({ grant_type: 'password', username: email, password }));
}

export function loggedIn(): boolean {
  return load() !== null;
}

export function logout(): void {
  save(null);
}

/** Valid access token, refreshing if expired; null when not logged in. */
export async function accessToken(): Promise<string | null> {
  const t = load();
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  try {
    const fresh = await tokenRequest(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
    );
    return fresh.access_token;
  } catch {
    save(null);
    return null;
  }
}
