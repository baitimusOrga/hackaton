import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const template = await readFile(new URL("../.env.example", import.meta.url), "utf8");
try {
  await writeFile(new URL("../.env", import.meta.url),
    template.replace("BETTER_AUTH_SECRET=", "BETTER_AUTH_SECRET=" + randomBytes(32).toString("base64url")),
    { flag: "wx", mode: 0o600 });
  console.log("Created local .env with a generated secret.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Kept existing .env.");
}
