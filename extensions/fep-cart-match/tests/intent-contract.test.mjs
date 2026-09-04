import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../assets/fep-match.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/fep-match.css", import.meta.url), "utf8");
const block = await readFile(new URL("../blocks/fep-match.liquid", import.meta.url), "utf8");
const drawer = await readFile(new URL("../blocks/fep-cart-drawer.liquid", import.meta.url), "utf8");
const evidence = await readFile(new URL("../evidence/synthetic-checkout.html", import.meta.url), "utf8");
const syntheticShopify = await readFile(new URL("../evidence/synthetic-shopify.js", import.meta.url), "utf8");
const adapter = await readFile(new URL("../../../services/shopify-ingestion-reference/src/b03Compatibility.js", import.meta.url), "utf8");
const source = `${js}\n${css}\n${block}\n${drawer}`;

test("customer choice creates priced Shopify cart lines", () => {
  assert.match(js, /cart\/add\.js/);
  assert.match(js, /cart\/update\.js/);
  assert.match(js, /contributionItems/);
  assert.match(js, /quantity: dollars/);
  assert.match(js, /quantity: cents/);
  assert.match(block, /contribution_cent_variant_id/);
  assert.match(block, /contribution_dollar_variant_id/);
});

test("the contribution excludes itself from percentage calculations", () => {
  assert.match(js, /baseSubtotalMinor/);
  assert.match(js, /filter\(\(item\) => !isFepItem\(item, config\)\)/);
  assert.match(js, /Math\.round\(subtotal \* rate\)/);
});

test("cart lines carry an auditable intent but do not claim allocation", () => {
  assert.match(js, /_FEP Intent Version/);
  assert.match(js, /_FEP Contribution Minor/);
  assert.match(js, /_FEP Route Code/);
  assert.match(js, /_FEP Source/);
  assert.match(js, /shopify_theme_cart/);
  assert.match(js, /Allocation begins only after Shopify confirms payment/);
});

test("drawer embed mounts responsively and refreshes theme cart surfaces", () => {
  assert.match(drawer, /"target": "body"/);
  assert.match(drawer, /data-fep-embed/);
  assert.match(js, /data-fep-drawer-mount/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /cart-drawer/);
  assert.match(js, /cart:refresh/);
  assert.match(js, /shopify:cart:lines-update/);
  assert.match(js, /key !== "fepEmbed"/);
  assert.match(js, /sections: SECTION_IDS/);
  assert.doesNotMatch(js, /window\.location\.reload/);
});

test("customer-facing terminology uses Movement, never Protocol", () => {
  assert.match(source, /Fulfillment Economics Movement/);
  assert.doesNotMatch(source, /Fulfillment Economics Protocol/i);
});

test("extension exposes two configurable percentage choices", () => {
  assert.match(block, /primary_percent/);
  assert.match(block, /secondary_percent/);
  assert.match(block, /fep-contribution-v2/);
  assert.match(js, /data-fep-rate/);
});

test("contribution requires an accessible explicit opt-in", () => {
  assert.match(js, /data-fep-opt-in/);
  assert.match(js, /I choose to add a priced Movement contribution/);
  assert.match(js, /Choose the explicit opt-in before adding/);
  assert.match(js, /role="group" aria-label="Choose a contribution amount"/);
});

test("both cart surfaces expose a default-off kill switch", () => {
  assert.match(block, /data-fep-enabled/);
  assert.match(drawer, /data-fep-enabled/);
  assert.match(block, /"id": "enabled"/);
  assert.match(drawer, /"id": "enabled"/);
  assert.match(block, /"default": false/);
  assert.match(drawer, /"default": false/);
  assert.match(js, /kill_switch|currently unavailable|config\.enabled/);
});

test("a disabled switch blocks additions without stranding an existing contribution", () => {
  assert.match(js, /fep-match--recovery/);
  assert.match(js, /New contributions are disabled/);
  assert.match(js, /You can still remove this existing line before checkout/);
  assert.match(js, /data-fep-remove/);
  assert.doesNotMatch(js, /if \(!config\.enabled\) return;/);
});

test("failed replacement restores the prior contribution and reports recovery truthfully", () => {
  assert.match(js, /restorableContributionItems/);
  assert.match(js, /previousItemsRemoved/);
  assert.match(js, /Your previous contribution was restored/);
  assert.match(js, /the previous contribution could not be restored/);
  assert.match(syntheticShopify, /failNextAdd/);
  assert.match(evidence, /Simulate next add failure/);
});

test("interactive controls expose durable status relationships and forced-color support", () => {
  assert.match(js, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(js, /aria-describedby/);
  assert.match(js, /aria-busy/);
  assert.match(css, /\[data-fep-drawer-mount\][\s\S]*box-sizing: border-box/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /:focus-visible/);
});

test("synthetic evidence pins exact B03 and declares zero external effects", () => {
  assert.match(adapter, /5db6cc8772c40a7127b7514c57787299ddad57a5/);
  assert.match(adapter, /12685f46a60edea23aaa0a5403e300bf8858066b/);
  assert.match(adapter, /bc43d5db8fe58230d6c3d35e32a73e1e8618b71e/);
  assert.match(adapter, /2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7/);
  assert.match(adapter, /eaf983e1496187a22688ddfed45b541fe88a3e2b70a2fbc60863fae1a9484208/);
  assert.match(adapter, /fep-balanced-journal\/v0\.1-draft/);
  assert.match(adapter, /bravi-b03-compatibility\/v0\.3-postcommit-consumer/);
  assert.match(adapter, /CALLER_COMMITTED_STATE_FORBIDDEN/);
  assert.match(adapter, /FEP_DERIVED_AFTER_ATOMIC_APPEND/);
  assert.match(adapter, /EXACT_TENANT_HEAD_POST_COMMIT_QUERY/);
  assert.match(adapter, /domainWritePerformed: false/);
  assert.match(adapter, /journalWritePerformed: false/);
  assert.match(adapter, /canonicalReadbackPerformed: false/);
  assert.match(evidence, /data-effect-posture="NO_EFFECT"/);
  assert.match(evidence, /5db6cc8772c40a7127b7514c57787299ddad57a5/);
  assert.match(evidence, /bravi-b03-compatibility\/v0\.3-postcommit-consumer/);
  assert.match(evidence, /Provider calls 0 · journal writes 0 · canonical readbacks 0/);
});
