#!/usr/bin/env node
// Audits Supabase migrations for non-idempotent statements.
// Usage: node scripts/check-migration-idempotency.mjs

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";

const patterns = [
  {
    name: "CREATE TABLE (no IF NOT EXISTS)",
    regex: /^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/im,
  },
  {
    name: "CREATE INDEX (no IF NOT EXISTS)",
    regex: /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS|CONCURRENTLY\s+IF)/im,
  },
  {
    name: "CREATE VIEW (no OR REPLACE)",
    regex: /^\s*CREATE\s+(MATERIALIZED\s+)?VIEW\s+(?!OR\s+REPLACE|IF\s+NOT\s+EXISTS)/im,
  },
  {
    name: "CREATE FUNCTION (no OR REPLACE)",
    regex: /^\s*CREATE\s+FUNCTION\s+(?!OR\s+REPLACE)/im,
  },
  {
    name: "CREATE TRIGGER (no DROP first)",
    regex: /^\s*CREATE\s+TRIGGER\s+/im,
    requirePrior: /DROP\s+TRIGGER\s+IF\s+EXISTS/im,
  },
  {
    name: "CREATE POLICY (no DROP first)",
    regex: /^\s*CREATE\s+POLICY\s+/im,
    requirePrior: /DROP\s+POLICY\s+IF\s+EXISTS/im,
  },
  {
    name: "ALTER TABLE ADD COLUMN (no IF NOT EXISTS)",
    regex: /ALTER\s+TABLE[^;]+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/im,
  },
  {
    name: "ALTER TABLE DROP COLUMN (no IF EXISTS)",
    regex: /ALTER\s+TABLE[^;]+DROP\s+COLUMN\s+(?!IF\s+EXISTS)/im,
  },
  {
    name: "ALTER TABLE ADD CONSTRAINT (no DROP first)",
    regex: /ALTER\s+TABLE[^;]+ADD\s+CONSTRAINT\s+/im,
    requirePrior: /ALTER\s+TABLE[^;]+DROP\s+CONSTRAINT\s+IF\s+EXISTS/im,
  },
  {
    name: "CREATE TYPE (no DO $$ guard)",
    regex: /^\s*CREATE\s+TYPE\s+/im,
    requirePrior: /DO\s+\$\$/im,
  },
];

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const report = [];
let totalIssues = 0;

for (const file of files) {
  const content = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  const issues = [];

  for (const pattern of patterns) {
    const matches = [...content.matchAll(new RegExp(pattern.regex.source, "gim"))];
    if (matches.length === 0) continue;
    if (pattern.requirePrior && pattern.requirePrior.test(content)) continue;
    issues.push({ pattern: pattern.name, count: matches.length });
  }

  if (issues.length > 0) {
    report.push({ file, issues });
    totalIssues += issues.reduce((sum, i) => sum + i.count, 0);
  }
}

console.log(`\nMigration idempotency audit\n`);
console.log(`Files scanned: ${files.length}`);
console.log(`Files with issues: ${report.length}`);
console.log(`Total non-idempotent statements: ${totalIssues}\n`);

for (const { file, issues } of report) {
  console.log(file);
  for (const issue of issues) {
    console.log(`  - ${issue.pattern}: ${issue.count}`);
  }
}
