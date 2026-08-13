import {
  authenticatedIntegrationContext,
  encryptToken,
  exchangeAuthorizationCode,
  fetchProviderAccount,
  integrationIsConfigured,
  verifyOAuthState,
  type IntegrationProvider,
} from "@/lib/integrations/oauth";

function isProvider(value: string): value is IntegrationProvider {
  return value === "google" || value === "zoom";
}

function resultUrl(request: Request, provider: string, status: string) {
  return new URL(
    `/?integration=${provider}&integration_status=${status}`,
    request.url,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: value } = await params;
  if (!isProvider(value))
    return Response.redirect(resultUrl(request, value, "unsupported"));
  const url = new URL(request.url);
  if (url.searchParams.get("error"))
    return Response.redirect(resultUrl(request, value, "cancelled"));
  const code = url.searchParams.get("code");
  const stateValue = url.searchParams.get("state");
  if (!code || !stateValue || !integrationIsConfigured(value))
    return Response.redirect(resultUrl(request, value, "failed"));

  try {
    const state = await verifyOAuthState(stateValue, value);
    const { supabase, user, organizationId } =
      await authenticatedIntegrationContext();
    if (state.userId !== user.id || state.organizationId !== organizationId)
      throw new Error("OAuth account did not match the signed-in coach.");
    const redirectUri = new URL(
      `/api/integrations/${value}/callback`,
      request.url,
    ).toString();
    const tokens = await exchangeAuthorizationCode(value, code, redirectUri);
    const account = await fetchProviderAccount(value, tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    const { error } = await supabase.rpc("save_integration_oauth_connection", {
      target_organization: organizationId,
      target_provider: value,
      target_account_email: account.email,
      target_external_account_id: account.id,
      target_scopes: tokens.scope?.split(/\s+/).filter(Boolean) || [],
      encrypted_access_token: await encryptToken(tokens.access_token),
      encrypted_refresh_token: tokens.refresh_token
        ? await encryptToken(tokens.refresh_token)
        : "",
      target_token_expires_at: expiresAt,
    });
    if (error) throw error;
    return Response.redirect(resultUrl(request, value, "connected"));
  } catch {
    return Response.redirect(resultUrl(request, value, "failed"));
  }
}
