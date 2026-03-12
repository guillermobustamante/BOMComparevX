import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from '../../apps/backend/node_modules/xlsx/xlsx.mjs';

const [, , fileAArg, fileBArg] = process.argv;

if (!fileAArg || !fileBArg) {
  console.error('Usage: node tools/qa/validate-occurrence-bom-pair.mjs <fileA> <fileB>');
  process.exit(1);
}

const HEADER_CANDIDATES = {
  occurrenceId: [
    'occurrenceinternalname',
    'occurrenceinternalid',
    'occurrenceid',
    'instanceid',
    'instanceinternalname',
    'itemnode'
  ],
  objectId: ['partkey', 'linkedobjectname', 'linkedobjectid', 'objectid', 'elemid', 'elementid'],
  description: ['partname', 'description', 'partdescription'],
  parentPath: ['parentpath'],
  assemblyPath: ['assemblypath']
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function loadRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellText: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = typeof value === 'string' ? value.trim() : value;
    }
    return normalized;
  });
}

function resolveHeader(headers, aliases) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const exactIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));
  if (exactIndex >= 0) return headers[exactIndex];
  return headers.find((header) => aliases.some((alias) => normalizeHeader(header).includes(alias))) || null;
}

function compareRows(left, right) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.filter((key) => String(left[key] ?? '') !== String(right[key] ?? ''));
}

const fileA = path.resolve(fileAArg);
const fileB = path.resolve(fileBArg);
const rowsA = loadRows(fileA);
const rowsB = loadRows(fileB);
const headers = [...new Set([...Object.keys(rowsA[0] || {}), ...Object.keys(rowsB[0] || {})])];
const occurrenceHeader = resolveHeader(headers, HEADER_CANDIDATES.occurrenceId);
const objectHeader = resolveHeader(headers, HEADER_CANDIDATES.objectId);
const descriptionHeader = resolveHeader(headers, HEADER_CANDIDATES.description);
const parentPathHeader = resolveHeader(headers, HEADER_CANDIDATES.parentPath);
const assemblyPathHeader = resolveHeader(headers, HEADER_CANDIDATES.assemblyPath);

console.log(`fileA=${fileA}`);
console.log(`fileB=${fileB}`);
console.log(`occurrenceHeader=${occurrenceHeader || '<none>'}`);
console.log(`objectHeader=${objectHeader || '<none>'}`);
console.log(`descriptionHeader=${descriptionHeader || '<none>'}`);
console.log(`parentPathHeader=${parentPathHeader || '<none>'}`);
console.log(`assemblyPathHeader=${assemblyPathHeader || '<none>'}`);

if (!occurrenceHeader) {
  console.log('No occurrence-level identifier detected. Review matching heuristics manually.');
  process.exit(0);
}

const mapA = new Map(rowsA.map((row) => [String(row[occurrenceHeader] || '').trim(), row]));
const mapB = new Map(rowsB.map((row) => [String(row[occurrenceHeader] || '').trim(), row]));
const keys = [...new Set([...mapA.keys(), ...mapB.keys()])].filter(Boolean).sort();

let identical = 0;
let changed = 0;
let missing = 0;

for (const key of keys) {
  const left = mapA.get(key);
  const right = mapB.get(key);
  if (!left || !right) {
    missing += 1;
    console.log(`MISSING occurrence=${key}`);
    continue;
  }

  const diffs = compareRows(left, right);
  if (diffs.length === 0) {
    identical += 1;
    continue;
  }

  changed += 1;
  console.log(`CHANGED occurrence=${key} fields=${diffs.join(',')}`);
}

console.log(`summary identical=${identical} changed=${changed} missing=${missing}`);
