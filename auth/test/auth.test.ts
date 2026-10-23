import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { createAuth } from "../src/auth.js";
import { migrate } from "../src/database.js";

test("email sessions, salted passwords, persistent keys, RS256 claims and origin protection",
  { skip: !process.env.AUTH_TEST_DATABASE_URL }, async () => {
    const config = {
      secret: process.env.BETTER_AUTH_SECRET ?? randomBytes(32).toString("hex"),
      databaseURL: process.env.AUTH_TEST_DATABASE_URL!,
      baseURL: "http://localhost:4200",
      port: 3000,
    };
    const service = createAuth(config);
    const request = (path: string, method = "GET", body?: object, cookie?: string, origin = config.baseURL) =>
      service.auth.handler(new Request(config.baseURL + "/api/auth" + path, {
        method, headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }));
    try {
      await migrate(service);
      await migrate(service);
      const email = randomUUID() + "@example.com";
      const password = "a long integration passphrase";
      const signup = await request("/sign-up/email", "POST", { name: "Test Seller", email, password });
      assert.equal(signup.status, 200, await signup.clone().text());
      const secondEmail = randomUUID() + "@example.com";
      assert.equal((await request("/sign-up/email", "POST", { name: "Another Seller", email: secondEmail, password })).status, 200);
      const hashes = await service.pool.query('select password from auth.account where "userId" in (select id from auth."user" where email = any($1))', [[email, secondEmail]]);
      assert.equal(hashes.rowCount, 2);
      assert.notEqual(hashes.rows[0].password, hashes.rows[1].password);
      assert.ok(hashes.rows.every((row: { password: string }) => !row.password.includes(password)));
      const login = await request("/sign-in/email", "POST", { email, password });
      assert.equal(login.status, 200);
      const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
      assert.ok(cookie);
      const tokenResponse = await request("/token", "GET", undefined, cookie);
      assert.equal(tokenResponse.status, 200);
      const { token } = await tokenResponse.json() as { token: string };
      const jwks = await (await request("/jwks")).json();
      const verified = await jwtVerify(token, createLocalJWKSet(jwks), {
        algorithms: ["RS256"], issuer: config.baseURL, audience: "hackaton-api",
      });
      assert.equal(verified.payload.email, email);
      assert.equal(verified.payload.name, "Test Seller");
      assert.ok(verified.payload.sub);
      assert.ok(verified.payload.exp! - verified.payload.iat! <= 300);
      const restarted = createAuth(config);
      try {
        const restored = await restarted.auth.api.getSession({ headers: new Headers({ cookie }) });
        assert.equal(restored?.user.email, email);
      } finally { await restarted.pool.end(); }
      const invalidOrigin = await request("/sign-in/email", "POST", { email, password }, undefined, "https://untrusted.example");
      assert.equal(invalidOrigin.status, 403);
      assert.equal((await request("/sign-out", "POST", {}, cookie)).status, 200);
      assert.equal((await request("/token", "GET", undefined, cookie)).status, 401);
      assert.equal((await request("/sign-in/email", "POST", { email, password: "wrong" })).status, 401);
    } finally { await service.pool.end(); }
  });
