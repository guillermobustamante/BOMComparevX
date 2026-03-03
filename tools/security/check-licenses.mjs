import { readFileSync, existsSync } from "node:fs";

const policyPath = "docs/security/license-policy.json";
if (!existsSync(policyPath)) {
  console.error(`Missing license policy file: ${policyPath}`);
  process.exit(1);
}

const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const denyPatterns = (policy.denyPatterns || []).map((entry) => String(entry).toLowerCase());
const failOnUnknown = Boolean(policy.failOnUnknown || false);

const lockFiles = ["package-lock.json", "apps/backend/package-lock.json", "apps/frontend/package-lock.json"];
const violations = [];
const unknowns = [];

for (const lockPath of lockFiles) {
  if (!existsSync(lockPath)) continue;
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const packages = lock.packages || {};
  for (const [pkgPath, pkg] of Object.entries(packages)) {
    const name = pkgPath || "(root)";
    const license = String(pkg?.license || "").trim();
    if (!license) {
      unknowns.push({ lockPath, name });
      continue;
    }
    const normalized = license.toLowerCase();
    const blocked = denyPatterns.find((pattern) => normalized.includes(pattern));
    if (blocked) {
      violations.push({ lockPath, name, license, blockedBy: blocked });
    }
  }
}

if (violations.length > 0) {
  console.error("License policy violations:");
  for (const item of violations) {
    console.error(
      `- [${item.lockPath}] ${item.name} => ${item.license} (blocked by pattern: ${item.blockedBy})`
    );
  }
  process.exit(1);
}

if (failOnUnknown && unknowns.length > 0) {
  console.error("Packages with unknown/missing licenses:");
  for (const item of unknowns.slice(0, 100)) {
    console.error(`- [${item.lockPath}] ${item.name}`);
  }
  process.exit(1);
}

console.log(
  `License gate passed. Checked ${lockFiles.length} lock files; unknown licenses: ${unknowns.length}.`
);

