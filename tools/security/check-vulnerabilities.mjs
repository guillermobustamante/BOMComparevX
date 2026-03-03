import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const commands = [
  { label: "root", args: ["audit", "--omit=dev", "--json"] },
  { label: "apps/backend", args: ["--prefix", "apps/backend", "audit", "--omit=dev", "--json"] },
  { label: "apps/frontend", args: ["--prefix", "apps/frontend", "audit", "--omit=dev", "--json"] }
];
const allowlistPath = ".security/vulnerability-allowlist.json";
const allowlist = loadAllowlist();

const skip = String(process.env.SECURITY_VULN_GATE_SKIP_AUDIT || "").trim().toLowerCase();
if (["1", "true", "yes", "on"].includes(skip)) {
  console.log("Vulnerability gate skipped by SECURITY_VULN_GATE_SKIP_AUDIT.");
  process.exit(0);
}

let failed = false;

for (const command of commands) {
  const run = spawnSync("npm", command.args, {
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  const output = `${run.stdout || ""}${run.stderr || ""}`.trim();
  let parsed = null;
  try {
    parsed = output ? JSON.parse(output) : null;
  } catch {
    console.error(`Unable to parse npm audit JSON for ${command.label}.`);
    if (output) {
      console.error(output.slice(0, 1200));
    }
    failed = true;
    continue;
  }

  const counts = parsed?.metadata?.vulnerabilities || {};
  const high = Number(counts.high || 0);
  const critical = Number(counts.critical || 0);
  const blocking = blockingFindings(parsed?.vulnerabilities || {});
  console.log(
    `[${command.label}] vulnerabilities => critical=${critical}, high=${high}, moderate=${
      Number(counts.moderate || 0)
    }, low=${Number(counts.low || 0)}`
  );

  if (blocking.length > 0) {
    console.error(
      `[${command.label}] blocking vulnerabilities detected (critical/high, not allowlisted).`
    );
    for (const finding of blocking) {
      console.error(`- package=${finding.name} severity=${finding.severity} advisories=${finding.advisories.join("|")}`);
    }
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Vulnerability gate passed.");

function loadAllowlist() {
  if (!existsSync(allowlistPath)) {
    return {
      allowedPackages: [],
      allowedAdvisories: []
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
    return {
      allowedPackages: Array.isArray(parsed.allowedPackages)
        ? parsed.allowedPackages.map((entry) => String(entry).toLowerCase())
        : [],
      allowedAdvisories: Array.isArray(parsed.allowedAdvisories)
        ? parsed.allowedAdvisories.map((entry) => String(entry))
        : []
    };
  } catch {
    console.error(`Invalid JSON in ${allowlistPath}`);
    process.exit(1);
  }
}

function blockingFindings(vulnerabilityMap) {
  const findings = [];
  for (const [name, details] of Object.entries(vulnerabilityMap)) {
    const severity = String(details?.severity || "").toLowerCase();
    if (!["high", "critical"].includes(severity)) continue;

    const advisories = (Array.isArray(details?.via) ? details.via : [])
      .filter((entry) => typeof entry === "object" && entry)
      .map((entry) => String(entry.source || entry.url || entry.name || "unknown"));
    const packageAllowed = allowlist.allowedPackages.includes(String(name).toLowerCase());
    const advisoryAllowed =
      advisories.length > 0 &&
      advisories.every((advisory) => allowlist.allowedAdvisories.includes(advisory));
    if (packageAllowed || advisoryAllowed) continue;
    findings.push({
      name,
      severity,
      advisories
    });
  }
  return findings;
}
