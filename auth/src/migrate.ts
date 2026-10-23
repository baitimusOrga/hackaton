import { createAuth } from "./auth.js";
import { readConfig } from "./config.js";
import { migrate } from "./database.js";

const service = createAuth(readConfig());
try {
  await migrate(service);
  console.log("Better Auth schema is current.");
} finally {
  await service.pool.end();
}
