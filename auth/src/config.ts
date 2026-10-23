export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters. Run pnpm setup locally.");
  const baseURL = env.BETTER_AUTH_URL ?? "http://localhost:4200";
  const url = new URL(baseURL);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("BETTER_AUTH_URL must be a plain HTTP(S) origin.");
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production BETTER_AUTH_URL must use HTTPS.");
  }
  const databaseURL = env.DATABASE_URL;
  if (!databaseURL) throw new Error("DATABASE_URL is required.");
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  return { secret, baseURL: url.origin, databaseURL, port };
}

export type AuthConfig = ReturnType<typeof readConfig>;
