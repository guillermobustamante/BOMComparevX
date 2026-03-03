import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ignoreDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  "logs",
  "artifacts"
]);

const ignoreExt = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
  ".docx",
  ".xlsx",
  ".zip",
  ".ico",
  ".woff",
  ".woff2"
]);

const defaultIgnoreFiles = new Set([".env.example"]);
const customIgnorePath = ".security/secret-scan-ignore.txt";
if (existsSync(customIgnorePath)) {
  const lines = readFileSync(customIgnorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const line of lines) {
    defaultIgnoreFiles.add(line.replace(/\\/g, "/"));
  }
}

const patterns = [
  { id: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "private_key_block", regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/g },
  { id: "github_pat", regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { id: "slack_token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  {
    id: "generic_secret_assignment",
    regex: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][^"'\n]{20,}["']/gi
  }
];

const findings = [];

scan(".");

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} potential secret(s):`);
  for (const finding of findings.slice(0, 200)) {
    console.error(
      `- ${finding.file}:${finding.line} [${finding.pattern}] ${finding.snippet.slice(0, 120)}`
    );
  }
  process.exit(1);
}

console.log("Secret scan passed.");

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const normalized = fullPath.replace(/\\/g, "/").replace(/^\.\//, "");

    if (shouldIgnorePath(normalized, entry)) continue;
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      scan(fullPath);
      continue;
    }
    if (ignoreExt.has(extname(entry).toLowerCase())) continue;
    if (stats.size > 2 * 1024 * 1024) continue;

    const text = readFileSync(fullPath, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(lineText)) {
          findings.push({
            file: normalized,
            line: idx + 1,
            pattern: pattern.id,
            snippet: lineText.trim()
          });
        }
        pattern.regex.lastIndex = 0;
      }
    });
  }
}

function shouldIgnorePath(normalized, entryName) {
  if (ignoreDirs.has(entryName)) return true;
  if (defaultIgnoreFiles.has(normalized)) return true;
  return false;
}

