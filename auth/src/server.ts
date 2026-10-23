import { createServer } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth.js";
import { readConfig } from "./config.js";
import { migrate } from "./database.js";

const config = readConfig();
const service = createAuth(config);
await migrate(service);
const handler = toNodeHandler(service.auth);
const server = createServer((request, response) => {
  void Promise.resolve(handler(request, response)).catch(() => {
    console.error("Auth request failed.");
    if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json" });
    response.end('{"message":"Authentication is temporarily unavailable."}');
  });
});
server.listen(config.port, "0.0.0.0", () => console.log("Auth service listening on port " + config.port));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => void service.pool.end().then(() => process.exit(0))));
}
