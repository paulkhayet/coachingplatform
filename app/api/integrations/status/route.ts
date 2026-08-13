import { integrationIsConfigured } from "@/lib/integrations/oauth";

export async function GET() {
  return Response.json({
    google: integrationIsConfigured("google"),
    zoom: integrationIsConfigured("zoom"),
  });
}
