import { createHmac, timingSafeEqual } from "node:crypto";

const TOPICS = new Map([
  ["orders/paid", "ORDER_SETTLED"],
  ["orders/cancelled", "ORDER_CANCELLED"],
  ["refunds/create", "REFUND_RECORDED"],
  ["app/uninstalled", "APP_UNINSTALLED"],
  ["customers/data_request", "PRIVACY_CUSTOMER_DATA_REQUEST"],
  ["customers/redact", "PRIVACY_CUSTOMER_REDACT"],
  ["shop/redact", "PRIVACY_SHOP_REDACT"],
]);

const PRIVACY_EVENT_TYPES = new Set([
  "PRIVACY_CUSTOMER_DATA_REQUEST",
  "PRIVACY_CUSTOMER_REDACT",
  "PRIVACY_SHOP_REDACT",
]);

export class ShopifyWebhookError extends Error {}

function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") return headers.get(name);
  const expected = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === expected) return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

export function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!secret || typeof secret !== "string") throw new ShopifyWebhookError("webhook secret is required");
  if (!hmacHeader || typeof hmacHeader !== "string") return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const expected = createHmac("sha256", secret).update(body).digest();
  let supplied;
  try {
    supplied = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function canonicalTopic(topic) {
  const normalized = String(topic ?? "").trim().toLowerCase();
  const eventType = TOPICS.get(normalized);
  if (!eventType) throw new ShopifyWebhookError(`unsupported Shopify topic: ${normalized || "missing"}`);
  return eventType;
}

function toBigIntId(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function moneyToMinor(value) {
  const text = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,}))?$/.exec(text);
  if (!match) throw new ShopifyWebhookError(`invalid money value: ${text}`);
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = `${match[3] ?? ""}00`.slice(0, 2);
  const thirdDigit = Number((match[3] ?? "")[2] ?? "0");
  let minor = whole * 100n + BigInt(fraction || "0");
  if (thirdDigit >= 5) minor += 1n;
  return sign * minor;
}

function safeNumber(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new ShopifyWebhookError(`${label} exceeds safe integer range`);
  }
  return Number(value);
}

function rewardForBasis(basisMinor, rateBps) {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new ShopifyWebhookError("program rate_bps must be an integer from 0 to 10000");
  }
  const numerator = BigInt(basisMinor) * BigInt(rateBps);
  return safeNumber((numerator + 5_000n) / 10_000n, "reward amount");
}

function stringSet(values) {
  if (values === null || values === undefined) return new Set();
  if (typeof values[Symbol.iterator] !== "function") {
    throw new ShopifyWebhookError("program exclusions must be iterable");
  }
  return new Set(Array.from(values, (value) => String(value)));
}

function normalizedProgram(program) {
  if (!program || typeof program !== "object") throw new ShopifyWebhookError("reward program is required");
  const id = String(program.id ?? "").trim();
  const version = String(program.version ?? "").trim();
  const currency = String(program.currency ?? "USD").trim().toUpperCase();
  if (!id || !version) throw new ShopifyWebhookError("reward program id and version are required");
  if (!/^[A-Z]{3}$/.test(currency)) throw new ShopifyWebhookError("reward program currency is invalid");
  return {
    id,
    version,
    currency,
    rateBps: Number(program.rateBps),
    excludedProductIds: stringSet(program.excludedProductIds),
    excludedVariantIds: stringSet(program.excludedVariantIds),
    excludeGiftCards: program.excludeGiftCards !== false,
  };
}

function lineIsEligible(line, program) {
  const productId = toBigIntId(line.product_id);
  const variantId = toBigIntId(line.variant_id);
  if (productId && program.excludedProductIds.has(productId)) return false;
  if (variantId && program.excludedVariantIds.has(variantId)) return false;
  if (program.excludeGiftCards && line.gift_card === true) return false;
  return true;
}

function orderLineBasisMinor(line, program) {
  if (!lineIsEligible(line, program)) return 0n;
  const quantity = BigInt(Math.max(0, Number.parseInt(String(line.quantity ?? 0), 10) || 0));
  const gross = moneyToMinor(line.price ?? "0") * quantity;
  const discount = moneyToMinor(line.total_discount ?? "0");
  return gross > discount ? gross - discount : 0n;
}

export function computeEligibleOrderBasisMinor(order, rawProgram) {
  const program = normalizedProgram(rawProgram);
  const currency = String(order?.currency ?? order?.presentment_currency ?? "").toUpperCase();
  if (currency !== program.currency) throw new ShopifyWebhookError("order currency does not match reward program");
  const lines = Array.isArray(order?.line_items) ? order.line_items : [];
  const basis = lines.reduce((sum, line) => sum + orderLineBasisMinor(line, program), 0n);
  return safeNumber(basis, "eligible order basis");
}

function refundLineBasisMinor(refundLine, program) {
  const line = refundLine?.line_item ?? {};
  if (!lineIsEligible(line, program)) return 0n;
  if (refundLine?.subtotal !== undefined && refundLine?.subtotal !== null) {
    const subtotal = moneyToMinor(refundLine.subtotal);
    return subtotal > 0n ? subtotal : 0n;
  }
  const quantity = BigInt(Math.max(0, Number.parseInt(String(refundLine?.quantity ?? 0), 10) || 0));
  const gross = moneyToMinor(line.price ?? "0") * quantity;
  return gross > 0n ? gross : 0n;
}

export function computeEligibleRefundBasisMinor(refund, rawProgram) {
  const program = normalizedProgram(rawProgram);
  const lines = Array.isArray(refund?.refund_line_items) ? refund.refund_line_items : [];
  const basis = lines.reduce((sum, line) => sum + refundLineBasisMinor(line, program), 0n);
  return safeNumber(basis, "eligible refund basis");
}

function commonEnvelope({ eventType, shopDomain, webhookId, topic, payload, program }) {
  return {
    sourceSystem: "SHOPIFY",
    sourceEventId: `${shopDomain}:${webhookId}`,
    shopDomain,
    webhookId,
    topic,
    eventType,
    occurredAt: payload?.created_at ?? payload?.updated_at ?? new Date(0).toISOString(),
    signatureVerified: true,
    program: {
      id: program.id,
      version: program.version,
      rateBps: program.rateBps,
      currency: program.currency,
    },
  };
}

export function normalizeVerifiedShopifyWebhook({ rawBody, headers, secret, program: rawProgram }) {
  const hmac = headerValue(headers, "x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(rawBody, hmac, secret)) throw new ShopifyWebhookError("Shopify HMAC verification failed");

  const webhookId = String(headerValue(headers, "x-shopify-webhook-id") ?? "").trim();
  const topic = String(headerValue(headers, "x-shopify-topic") ?? "").trim().toLowerCase();
  const shopDomain = String(headerValue(headers, "x-shopify-shop-domain") ?? "").trim().toLowerCase();
  if (!webhookId || !shopDomain) throw new ShopifyWebhookError("Shopify webhook identity headers are required");

  const eventType = canonicalTopic(topic);
  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
  } catch {
    throw new ShopifyWebhookError("Shopify webhook body is not valid JSON");
  }

  const program = normalizedProgram(rawProgram);
  const envelope = commonEnvelope({ eventType, shopDomain, webhookId, topic, payload, program });

  if (PRIVACY_EVENT_TYPES.has(eventType) || eventType === "APP_UNINSTALLED") {
    return {
      ...envelope,
      economic: false,
      resource: {
        shopId: toBigIntId(payload?.shop_id),
        customerId: toBigIntId(payload?.customer?.id ?? payload?.customer_id),
      },
    };
  }

  if (eventType === "ORDER_SETTLED") {
    const orderId = toBigIntId(payload?.id);
    if (!orderId) throw new ShopifyWebhookError("order id is required");
    const basisMinor = computeEligibleOrderBasisMinor(payload, program);
    return {
      ...envelope,
      economic: true,
      resource: { orderId },
      basisMinor,
      rewardMinor: rewardForBasis(basisMinor, program.rateBps),
      currency: program.currency,
    };
  }

  if (eventType === "REFUND_RECORDED") {
    const refundId = toBigIntId(payload?.id);
    const orderId = toBigIntId(payload?.order_id);
    if (!refundId || !orderId) throw new ShopifyWebhookError("refund and linked order ids are required");
    const basisMinor = computeEligibleRefundBasisMinor(payload, program);
    return {
      ...envelope,
      economic: true,
      resource: { refundId, orderId },
      basisMinor,
      rewardReversalMinor: rewardForBasis(basisMinor, program.rateBps),
      currency: program.currency,
      requiresOriginalAccrualLink: true,
    };
  }

  if (eventType === "ORDER_CANCELLED") {
    const orderId = toBigIntId(payload?.id);
    if (!orderId) throw new ShopifyWebhookError("order id is required");
    return {
      ...envelope,
      economic: false,
      resource: { orderId },
      note: "Cancellation alone does not reverse rewards; a linked refund or settlement correction is authoritative.",
    };
  }

  throw new ShopifyWebhookError(`unhandled Shopify event type: ${eventType}`);
}
