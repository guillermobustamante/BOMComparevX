import { readFileSync, existsSync } from "node:fs";

const requiredKeys = [
  "NODE_ENV",
  "APP_ENV",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AZURE_RESOURCE_GROUP",
  "AZURE_KEY_VAULT_URI",
  "WEB_BASE_URL",
  "API_BASE_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "GOOGLE_CALLBACK_URL",
  "MICROSOFT_CALLBACK_URL",
  "DEFAULT_TENANT_ID",
  "GOOGLE_CLIENT_ID_SECRET_NAME",
  "GOOGLE_CLIENT_SECRET_SECRET_NAME",
  "MICROSOFT_CLIENT_ID_SECRET_NAME",
  "MICROSOFT_CLIENT_SECRET_SECRET_NAME"
];

function parseEnv(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    map.set(key, value);
  }
  return map;
}

const envExamplePath = ".env.example";
if (!existsSync(envExamplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

const envMap = parseEnv(readFileSync(envExamplePath, "utf8"));
const missing = requiredKeys.filter((k) => !envMap.has(k));

if (missing.length > 0) {
  console.error("Missing required keys in .env.example:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log("Env contract check passed.");
