/**
 * Primo strato del multiplayer di My Kingdom.
 * I dati dei salvataggi locali non sono una fonte autorevole di risorse o saldo online.
 * La sessione è intenzionalmente solo in memoria finché non viene aggiunto
 * uno storage di credenziali sicuro per tutte le piattaforme.
 */
export type KingdomOnline = {
  id: string;
  name: string;
  owner_id?: string;
  created_at: string;
};

export type OnlineSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

let session: OnlineSession | null = null;
let refreshInFlight: Promise<void> | null = null;

export function multiplayerConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_MYKINGDOM_SUPABASE_URL?.trim() ?? "";
  const key = process.env.EXPO_PUBLIC_MYKINGDOM_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 10;
}

function config(): { url: string; key: string } {
  if (!multiplayerConfigured()) {
    throw new Error("Multiplayer non configurato: occorre un progetto Supabase dedicato a My Kingdom.");
  }
  return {
    url: (process.env.EXPO_PUBLIC_MYKINGDOM_SUPABASE_URL ?? "").trim().replace(/\/$/, ""),
    key: (process.env.EXPO_PUBLIC_MYKINGDOM_SUPABASE_PUBLISHABLE_KEY ?? "").trim()
  };
}

export function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Inserisci un indirizzo email valido.");
  }
  return normalized;
}

export function normalizeKingdomName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 40) {
    throw new Error("Il nome del regno deve contenere da 3 a 40 caratteri.");
  }
  return name;
}

type ServerSession = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  user?: { id?: unknown; email?: unknown };
};

function acceptSession(value: ServerSession): OnlineSession {
  if (
    typeof value.access_token !== "string" || !value.access_token ||
    typeof value.refresh_token !== "string" || !value.refresh_token ||
    typeof value.user?.id !== "string" || !value.user.id ||
    typeof value.expires_in !== "number" || !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    throw new Error("La risposta di autenticazione non contiene una sessione valida.");
  }
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: Date.now() + value.expires_in * 1000,
    user: {
      id: value.user.id,
      email: typeof value.user.email === "string" ? value.user.email : undefined
    }
  };
}

async function rawRequest<T>(
  path: string,
  options: { method?: string; token?: string; payload?: unknown; prefer?: string } = {}
): Promise<T> {
  const { url, key } = config();
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.prefer) headers.Prefer = options.prefer;
  const response = await fetch(`${url}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.payload === undefined ? {} : { body: JSON.stringify(options.payload) })
  });
  const body = await response.text();
  let parsed: unknown = null;
  if (body) {
    try { parsed = JSON.parse(body); } catch { parsed = null; }
  }
  if (!response.ok) {
    const error = parsed as { msg?: string; message?: string; error_description?: string } | null;
    throw new Error(error?.msg || error?.message || error?.error_description || `Errore server (${response.status}).`);
  }
  return parsed as T;
}

export function currentOnlineSession(): OnlineSession | null {
  return session;
}

export async function sendLoginCode(email: string): Promise<void> {
  await rawRequest("/auth/v1/otp", {
    method: "POST",
    payload: { email: validateEmail(email), create_user: true }
  });
}

export async function verifyLoginCode(email: string, code: string): Promise<OnlineSession> {
  const token = code.trim();
  if (!/^\d{6,8}$/.test(token)) throw new Error("Inserisci il codice numerico ricevuto via email.");
  const response = await rawRequest<ServerSession>("/auth/v1/verify", {
    method: "POST",
    payload: { email: validateEmail(email), token, type: "email" }
  });
  session = acceptSession(response);
  return session;
}

async function validSession(): Promise<OnlineSession> {
  if (!session) throw new Error("Accedi al multiplayer prima di continuare.");
  if (Date.now() + 60_000 < session.expires_at) return session;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      if (!session) throw new Error("Sessione scaduta.");
      const next = await rawRequest<ServerSession>("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        payload: { refresh_token: session.refresh_token }
      });
      session = acceptSession(next);
    })().finally(() => { refreshInFlight = null; });
  }
  try {
    await refreshInFlight;
  } catch {
    session = null;
    throw new Error("Sessione scaduta. Effettua nuovamente l'accesso.");
  }
  if (!session) throw new Error("Sessione scaduta.");
  return session;
}

export async function signOutOnline(): Promise<void> {
  const access = session?.access_token;
  session = null;
  refreshInFlight = null;
  if (access) {
    try { await rawRequest("/auth/v1/logout", { method: "POST", token: access }); }
    catch { /* Una sessione locale dimenticata non deve essere ripristinabile. */ }
  }
}

export async function myOnlineKingdom(): Promise<KingdomOnline | null> {
  const active = await validSession();
  const list = await rawRequest<KingdomOnline[]>(
    `/rest/v1/mk_kingdoms?select=id,name,owner_id,created_at&owner_id=eq.${encodeURIComponent(active.user.id)}&limit=1`,
    { token: active.access_token }
  );
  return list[0] ?? null;
}

export async function createOnlineKingdom(name: string): Promise<KingdomOnline> {
  const active = await validSession();
  const list = await rawRequest<KingdomOnline[]>("/rest/v1/mk_kingdoms?select=id,name,owner_id,created_at", {
    method: "POST",
    token: active.access_token,
    prefer: "return=representation",
    payload: { owner_id: active.user.id, name: normalizeKingdomName(name) }
  });
  if (!list[0]) throw new Error("Il regno non è stato registrato.");
  return list[0];
}

export async function onlineKingdomDirectory(): Promise<KingdomOnline[]> {
  const active = await validSession();
  return rawRequest<KingdomOnline[]>(
    "/rest/v1/mk_kingdoms?select=id,name,created_at&order=created_at.desc&limit=30",
    { token: active.access_token }
  );
}
