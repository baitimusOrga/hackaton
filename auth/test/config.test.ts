import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";
import { randomBytes } from "node:crypto";

const env = { BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), DATABASE_URL: "postgres://localhost/hackaton" };
test("requires an explicit strong secret", () => {
  assert.throws(() => readConfig({ ...env, BETTER_AUTH_SECRET: "" }), /SECRET/);
});
test("accepts a local origin and rejects redirects or production HTTP", () => {
  assert.equal(readConfig(env).baseURL, "http://localhost:4200");
  assert.throws(() => readConfig({ ...env, BETTER_AUTH_URL: "https://example.com/path" }), /origin/);
  assert.throws(() => readConfig({ ...env, NODE_ENV: "production" }), /HTTPS/);
});
