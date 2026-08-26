import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../assets/fep-match.js', import.meta.url), 'utf8');
const liquid = await readFile(new URL('../blocks/fep-match.liquid', import.meta.url), 'utf8');

const source = `${js}\n${liquid}`;

test('theme extension never adds or removes contribution products', () => {
  assert.doesNotMatch(source, /\/cart\/add\.js/);
  assert.doesNotMatch(source, /\/cart\/change\.js/);
  assert.doesNotMatch(source, /contribution_cent_variant_id/i);
  assert.doesNotMatch(source, /contribution_dollar_variant_id/i);
});

test('theme extension stores preference metadata only', () => {
  assert.match(js, /\/cart\/update\.js/);
  assert.match(js, /_Bravvi FEP Route Preference/);
  assert.match(js, /_Bravvi FEP Intent Version/);
  assert.match(js, /shopify_theme_cart/);
});

test('copy states that preference does not create economic effect', () => {
  assert.match(js, /does not add a charge, create Rewards, reserve funding, or allocate money/);
  assert.match(js, /Economic value is created only from verified server-side events/);
});

test('client no longer offers contribution rate controls', () => {
  assert.doesNotMatch(source, /2\.5%/);
  assert.doesNotMatch(source, /5%/);
  assert.doesNotMatch(source, /Match 2\.5/);
  assert.doesNotMatch(source, /Match 5/);
});

test('checkout preference has explicit current version', () => {
  assert.match(liquid, /data-fep-intent-version="fep-intent-v1"/);
});
