import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sha256Hex, verifyTremendousSignature } from "./signature.ts";

const MAX_BODY_BYTES = 1_000_000;
const EVENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return json({ error: "invalid_content_length" }, 400);
  }
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
  const eventType = typeof event.event === "string" ? event.event.trim() : "";
  if (!EVENT_UUID.test(eventUuid) || !eventType) {
    return json({ error: "invalid_event" }, 400);
  }

  // Keep the raw provider payload in memory only. The authoritative Bravi boundary
  // stores the minimum replay/audit facts and a digest, not recipient or reward data.
  const payloadDigest = await sha256Hex(rawBody);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/bravi_record_webhook_event`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      _provider: `tremendous:${environment}`,
      _event_id: eventUuid,
      _event_type: eventType,
      _payload_digest: payloadDigest,
    }),
  });
  if (!response.ok) {
    console.error("Failed to persist Tremendous event metadata", response.status);
    return json({ error: "persistence_failed" }, 500);
  }

  const inserted = await response.json() as boolean;
  return json({ received: true, duplicate: inserted === false });
});
