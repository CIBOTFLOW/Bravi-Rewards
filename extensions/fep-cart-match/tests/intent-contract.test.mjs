import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../assets/fep-match.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/fep-match.css", import.meta.url), "utf8");
const block = await readFile(new URL("../blocks/fep-match.liquid", import.meta.url), "utf8");
const drawer = await readFile(new URL("../blocks/fep-cart-drawer.liquid", import.meta.url), "utf8");
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
