import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sha256Hex, verifyTremendousSignature } from "./signature.ts";

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("TREMENDOUS_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const environment = Deno.env.get("TREMENDOUS_ENVIRONMENT") ?? "sandbox";
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    console.error("Tremendous webhook configuration is incomplete");
    return json({ error: "service_unavailable" }, 503);
  }
  if (environment !== "sandbox" && environment !== "production") {
    console.error("TREMENDOUS_ENVIRONMENT must be sandbox or production");
    return json({ error: "service_unavailable" }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const validSignature = await verifyTremendousSignature(
    rawBody,
    request.headers.get("tremendous-webhook-signature"),
    secret,
  );
  if (!validSignature) return json({ error: "invalid_signature" }, 401);

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventUuid = typeof event.uuid === "string" ? event.uuid : "";
  const eventType = typeof event.event === "string" ? event.event : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventUuid) || !eventType) {
    return json({ error: "invalid_event" }, 400);
  }

  const payload = event.payload && typeof event.payload === "object"
    ? event.payload as Record<string, unknown>
    : {};
  const resource = payload.resource && typeof payload.resource === "object"
    ? payload.resource as Record<string, unknown>
    : {};
  const row = {
    provider: "tremendous",
    provider_environment: environment,
    event_uuid: eventUuid,
    event_type: eventType,
    provider_created_at: typeof event.created_utc === "string" ? event.created_utc : null,
    resource_type: typeof resource.type === "string" ? resource.type : null,
    resource_id: typeof resource.id === "string" ? resource.id : null,
    payload: event,
    payload_sha256: await sha256Hex(rawBody),
    signature_verified: true,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/bravi_reward_provider_events?on_conflict=provider,provider_environment,event_uuid`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    },
  );
  if (!response.ok) {
    console.error("Failed to persist Tremendous event", response.status, await response.text());
    return json({ error: "persistence_failed" }, 500);
  }

  const inserted = await response.json() as unknown[];
  return json({ received: true, duplicate: inserted.length === 0 });
});
