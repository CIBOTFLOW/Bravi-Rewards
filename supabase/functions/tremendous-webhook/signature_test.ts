import { sha256Hex, verifyTremendousSignature } from "./signature.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("accepts a valid Tremendous HMAC signature", async () => {
  const body = JSON.stringify({ uuid: "e3dc9ad8-c668-4c2b-9a8d-f0bcfdb93f45" });
  const secret = "test-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");

  assertEquals(await verifyTremendousSignature(body, `sha256=${hex}`, secret), true);
  assertEquals(await verifyTremendousSignature(`${body} `, `sha256=${hex}`, secret), false);
  assertEquals(await verifyTremendousSignature(body, null, secret), false);
});

Deno.test("hashes the untouched payload deterministically", async () => {
  assertEquals(
    await sha256Hex("bravi"),
    "ccb3a63665cb7e8b9828b7434be1e60b8f74591be697ea37dba87be9e27c756c",
  );
});
