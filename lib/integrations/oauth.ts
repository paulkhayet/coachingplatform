import { getSupabaseServerClient } from "@/lib/supabase/server";

export type IntegrationProvider = "google" | "zoom";

type OAuthState = {
  provider: IntegrationProvider;
  organizationId: string;
  userId: string;
  expiresAt: number;
  nonce: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function providerEnvironment(provider: IntegrationProvider) {
  return provider === "google"
    ? {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }
    : {
        clientId: process.env.ZOOM_CLIENT_ID,
        clientSecret: process.env.ZOOM_CLIENT_SECRET,
      };
}

export function integrationIsConfigured(provider: IntegrationProvider) {
  const environment = providerEnvironment(provider);
  return Boolean(
    environment.clientId &&
    environment.clientSecret &&
    process.env.INTEGRATION_ENCRYPTION_KEY,
  );
}

async function hmacKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret) throw new Error("Integration encryption is not configured.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createOAuthState(
  state: Omit<OAuthState, "expiresAt" | "nonce">,
) {
  const payload: OAuthState = {
    ...state,
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  };
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(encoded),
  );
  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyOAuthState(
  value: string,
  provider: IntegrationProvider,
) {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) throw new Error("Invalid OAuth state.");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromBase64Url(signature),
    encoder.encode(encoded),
  );
  if (!valid) throw new Error("Invalid OAuth state.");
  const state = JSON.parse(
    new TextDecoder().decode(fromBase64Url(encoded)),
  ) as OAuthState;
  if (state.provider !== provider || state.expiresAt < Date.now())
    throw new Error("OAuth state expired or did not match.");
  return state;
}

async function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret) throw new Error("Integration encryption is not configured.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
}

export async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function authenticatedIntegrationContext() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user)
    throw new Error("Sign in to connect an integration.");
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", authData.user.id)
    .limit(1)
    .single();
  if (membershipError || !membership)
    throw new Error("A coach practice is required to connect integrations.");
  return {
    supabase,
    user: authData.user,
    organizationId: membership.organization_id,
  };
}

export function authorizationUrl(
  provider: IntegrationProvider,
  redirectUri: string,
  state: string,
) {
  const environment = providerEnvironment(provider);
  if (!environment.clientId)
    throw new Error("Provider credentials are missing.");
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", environment.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set(
      "scope",
      [
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
      ].join(" "),
    );
    url.searchParams.set("state", state);
    return url;
  }
  const url = new URL("https://zoom.us/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", environment.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeAuthorizationCode(
  provider: IntegrationProvider,
  code: string,
  redirectUri: string,
) {
  const environment = providerEnvironment(provider);
  if (!environment.clientId || !environment.clientSecret)
    throw new Error("Provider credentials are missing.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (provider === "google") {
    body.set("client_id", environment.clientId);
    body.set("client_secret", environment.clientSecret);
  } else {
    headers.Authorization = `Basic ${btoa(`${environment.clientId}:${environment.clientSecret}`)}`;
  }
  const response = await fetch(
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://zoom.us/oauth/token",
    { method: "POST", headers, body, cache: "no-store" },
  );
  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || !tokens.access_token)
    throw new Error(
      tokens.error_description ||
        tokens.error ||
        "The provider rejected the connection.",
    );
  return tokens as TokenResponse & { access_token: string };
}

export async function fetchProviderAccount(
  provider: IntegrationProvider,
  accessToken: string,
) {
  const response = await fetch(
    provider === "google"
      ? "https://openidconnect.googleapis.com/v1/userinfo"
      : "https://api.zoom.us/v2/users/me",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const account = (await response.json()) as {
    sub?: string;
    id?: string;
    email?: string;
    account_id?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(account.message || "Unable to read the provider account.");
  return {
    id:
      provider === "google"
        ? account.sub || ""
        : account.id || account.account_id || "",
    email: account.email || "",
  };
}
