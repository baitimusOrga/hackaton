import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";
import { Pool } from "pg";
import type { AuthConfig } from "./config.js";

export function createAuth(config: AuthConfig) {
  const pool = new Pool({ connectionString: config.databaseURL, options: "-c search_path=auth" });
  const auth = betterAuth({
    appName: "hackaton",
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    database: pool,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database" },
    advanced: {
      ipAddress: {
        ...(config.trustedProxies.length && { trustedProxies: config.trustedProxies }),
        ...(config.ipHeader && { ipAddressHeaders: [config.ipHeader] }),
      },
    },
    plugins: [jwt({
      disableSettingJwtHeader: true,
      jwks: { keyPairConfig: { alg: "RS256" } },
      jwt: {
        issuer: config.baseURL,
        audience: "hackaton-api",
        expirationTime: "5m",
        definePayload: ({ user }) => ({ name: user.name, email: user.email }),
      },
    })],
  });
  return { auth, pool };
}
