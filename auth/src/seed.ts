import { createAuth } from "./auth.js";
import { readConfig } from "./config.js";
import { migrate } from "./database.js";

const config = readConfig();
const database = new URL(config.databaseURL);
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
    || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.baseURL).hostname)) {
  throw new Error("The test seed is restricted to local development.");
}
const service = createAuth(config);
try {
  await migrate(service);
  const existing = await service.pool.query('select id from auth."user" where email = $1', ["test@example.com"]);
  if (existing.rowCount === 0) {
    await service.auth.api.signUpEmail({ body: { email: "test@example.com", password: "LocalTest123!", name: "Local Test User" } });
  }
  console.log("Local test account is available: test@example.com. Existing accounts were preserved.");
} finally {
  await service.pool.end();
}
