const FEP_PROPERTIES = {
  type: "_FEP Type",
  version: "_FEP Intent Version",
  rateBps: "_FEP Rate BPS",
  contributionMinor: "_FEP Contribution Minor",
  route: "_FEP Route Code",
  source: "_FEP Source",
  followUp: "_FEP Follow Up",
};

function moneyToMinor(value) {
  const text = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,}))?$/.exec(text);
  if (!match) throw new Error(`invalid money value: ${text}`);
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
    throw new Error(`${label} exceeds safe integer range`);
  }
  return Number(value);
}

function idSet(values) {
  return values instanceof Set
    ? values
    : new Set(Array.from(values ?? [], (value) => String(value)));
}

function isContributionLine(line, variantIds) {
  return idSet(variantIds).has(String(line?.variant_id ?? ""));
}

function propertyValue(line, name) {
  const properties = line?.properties;
  if (Array.isArray(properties)) {
    return properties.find((property) => property?.name === name)?.value;
  }
  return properties && typeof properties === "object" ? properties[name] : undefined;
}

function lineAmountMinor(line) {
  const quantity = BigInt(Math.max(0, Number.parseInt(String(line?.quantity ?? 0), 10) || 0));
  const gross = moneyToMinor(line?.price ?? "0") * quantity;
  const discount = moneyToMinor(line?.total_discount ?? "0");
  return gross > discount ? gross - discount : 0n;
}

function refundLineAmountMinor(refundLine) {
  if (refundLine?.subtotal !== undefined && refundLine?.subtotal !== null) {
    const subtotal = moneyToMinor(refundLine.subtotal);
    return subtotal > 0n ? subtotal : 0n;
  }
  const line = refundLine?.line_item ?? {};
  const quantity = BigInt(Math.max(0, Number.parseInt(String(refundLine?.quantity ?? 0), 10) || 0));
  const gross = moneyToMinor(line?.price ?? "0") * quantity;
  return gross > 0n ? gross : 0n;
}

function consistentValue(lines, propertyName) {
  const values = Array.from(new Set(lines
    .map((line) => propertyValue(line, propertyName))
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(String)));
  return values.length === 1 ? values[0] : null;
}

export function summarizeFepContributionOrder(order, allowedVariantIds) {
  const variants = idSet(allowedVariantIds);
  const lines = (Array.isArray(order?.line_items) ? order.line_items : [])
    .filter((line) => isContributionLine(line, variants));
  if (!lines.length) return null;

  const amount = lines.reduce((sum, line) => sum + lineAmountMinor(line), 0n);
  const claimedMinorText = consistentValue(lines, FEP_PROPERTIES.contributionMinor);
  const claimedMinor = /^\d+$/.test(claimedMinorText ?? "") ? Number(claimedMinorText) : null;
  const rateBpsText = consistentValue(lines, FEP_PROPERTIES.rateBps);
  const rateBps = /^\d+$/.test(rateBpsText ?? "") ? Number(rateBpsText) : null;
  const metadataConsistent = lines.every((line) =>
    propertyValue(line, FEP_PROPERTIES.type) === "customer_contribution") &&
    [
      FEP_PROPERTIES.version,
      FEP_PROPERTIES.rateBps,
      FEP_PROPERTIES.contributionMinor,
      FEP_PROPERTIES.route,
      FEP_PROPERTIES.source,
      FEP_PROPERTIES.followUp,
    ].every((name) => consistentValue(lines, name) !== null);

  const amountMinor = safeNumber(amount, "FEP contribution amount");
  return {
    amountMinor,
    lineCount: lines.length,
    intentVersion: consistentValue(lines, FEP_PROPERTIES.version),
    route: consistentValue(lines, FEP_PROPERTIES.route),
    source: consistentValue(lines, FEP_PROPERTIES.source),
    followUpRequested: consistentValue(lines, FEP_PROPERTIES.followUp) === "yes",
    rateBps,
    metadataConsistent,
    claimedMinor,
    claimMatchesActual: claimedMinor !== null && claimedMinor === amountMinor,
    amountAuthority: "SHOPIFY_SETTLED_LINE_PRICES",
  };
}

export function summarizeFepContributionRefund(refund, allowedVariantIds) {
  const variants = idSet(allowedVariantIds);
  const lines = (Array.isArray(refund?.refund_line_items) ? refund.refund_line_items : [])
    .filter((refundLine) => isContributionLine(refundLine?.line_item, variants));
  if (!lines.length) return null;
  const amount = lines.reduce((sum, line) => sum + refundLineAmountMinor(line), 0n);
  return {
    amountMinor: safeNumber(amount, "FEP contribution refund amount"),
    lineCount: lines.length,
    amountAuthority: "SHOPIFY_REFUND_LINE_PRICES",
  };
}
