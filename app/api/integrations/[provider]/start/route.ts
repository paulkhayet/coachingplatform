import {
  authenticatedIntegrationContext,
  authorizationUrl,
  createOAuthState,
  integrationIsConfigured,
  type IntegrationProvider,
} from "@/lib/integrations/oauth";

function isProvider(value: string): value is IntegrationProvider {
  return value === "google" || value === "zoom";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: value } = await params;
  const appUrl = new URL("/", request.url);
  if (!isProvider(value))
    return Response.redirect(
      new URL("/?integration_status=unsupported", appUrl),
    );
  if (!integrationIsConfigured(value))
    return Response.redirect(
      new URL(
        `/?integration=${value}&integration_status=setup_required`,
        appUrl,
      ),
    );
  try {
    const { user, organizationId } = await authenticatedIntegrationContext();
    const redirectUri = new URL(
      `/api/integrations/${value}/callback`,
      request.url,
    ).toString();
    const state = await createOAuthState({
      provider: value,
      organizationId,
      userId: user.id,
    });
    return Response.redirect(authorizationUrl(value, redirectUri, state));
  } catch {
    return Response.redirect(
      new URL(
        `/?integration=${value}&integration_status=auth_required`,
        appUrl,
      ),
    );
  }
}
