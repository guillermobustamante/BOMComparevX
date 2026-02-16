import { existsSync } from "node:fs";

const requiredFiles = [
  "README.md",
  ".env.example",
  "docs/runbooks/s1-09-idp-keyvault-dev-setup.md",
  "BACKLOG_S1.md",
  "SPRINT_PLAN.md"
];

const missing = requiredFiles.filter((file) => !existsSync(file));

if (missing.length) {
  console.error("Missing required project files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Required files check passed.");
