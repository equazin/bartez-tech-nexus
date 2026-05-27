#!/usr/bin/env node
// Adds idempotency guards to Supabase migrations.
// - CREATE POLICY "x" ON table → DROP POLICY IF EXISTS "x" ON table; CREATE POLICY ...
// - CREATE TRIGGER x ON table → DROP TRIGGER IF EXISTS x ON table; CREATE TRIGGER ...
// - CREATE VIEW name → CREATE OR REPLACE VIEW name
// - CREATE FUNCTION name → CREATE OR REPLACE FUNCTION name
// - CREATE TABLE name → CREATE TABLE IF NOT EXISTS name
// - ALTER TABLE x ADD COLUMN col → ADD COLUMN IF NOT EXISTS col
// - ALTER TABLE x ADD CONSTRAINT name → ALTER TABLE x DROP CONSTRAINT IF EXISTS name; ADD CONSTRAINT ...
//
// Usage: node scripts/fix-migration-idempotency.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const dryRun = process.argv.includes("--dry-run");

let totalFixes = 0;
const fixedFiles = [];

function fixCreatePolicy(content) {
  let count = 0;
  const regex = /^([ \t]*)CREATE\s+POLICY\s+("[^"]+"|[A-Za-z_][\w]*)\s+ON\s+([A-Za-z_][\w.]*)/gim;
  const result = content.replace(regex, (match, indent, policyName, tableName, offset, fullString) => {
    const before = fullString.slice(Math.max(0, offset - 300), offset);
    const escapedName = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dropRegex = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${escapedName}\\s+ON\\s+${tableName}\\b`, "i");
    if (dropRegex.test(before)) return match;
    count++;
    return `${indent}DROP POLICY IF EXISTS ${policyName} ON ${tableName};\n${indent}CREATE POLICY ${policyName} ON ${tableName}`;
  });
  return { content: result, count };
}

function fixCreateTrigger(content) {
  let count = 0;
  const regex = /^([ \t]*)CREATE\s+TRIGGER\s+([A-Za-z_][\w]*)\s+([\s\S]*?ON\s+([A-Za-z_][\w.]*))/gim;
  const result = content.replace(regex, (match, indent, triggerName, rest, tableName, offset, fullString) => {
    const before = fullString.slice(Math.max(0, offset - 300), offset);
    const dropRegex = new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${triggerName}\\s+ON\\s+${tableName}\\b`, "i");
    if (dropRegex.test(before)) return match;
    count++;
    return `${indent}DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${indent}CREATE TRIGGER ${triggerName} ${rest}`;
  });
  return { content: result, count };
}

function fixCreateView(content) {
  let count = 0;
  const regex = /^([ \t]*)CREATE\s+VIEW\s+/gim;
  const result = content.replace(regex, (match, indent) => {
    count++;
    return `${indent}CREATE OR REPLACE VIEW `;
  });
  return { content: result, count };
}

function fixCreateFunction(content) {
  let count = 0;
  const regex = /^([ \t]*)CREATE\s+FUNCTION\s+/gim;
  const result = content.replace(regex, (match, indent) => {
    count++;
    return `${indent}CREATE OR REPLACE FUNCTION `;
  });
  return { content: result, count };
}

function fixCreateTable(content) {
  let count = 0;
  const regex = /^([ \t]*)CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gim;
  const result = content.replace(regex, (match, indent) => {
    count++;
    return `${indent}CREATE TABLE IF NOT EXISTS `;
  });
  return { content: result, count };
}

function fixAlterAddColumn(content) {
  let count = 0;
  const regex = /ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)([A-Za-z_])/gim;
  const result = content.replace(regex, (match, firstChar) => {
    count++;
    return `ADD COLUMN IF NOT EXISTS ${firstChar}`;
  });
  return { content: result, count };
}

function fixAlterAddConstraint(content) {
  let count = 0;
  const regex = /^([ \t]*)ALTER\s+TABLE\s+(?:ONLY\s+)?([A-Za-z_][\w.]*)\s+ADD\s+CONSTRAINT\s+([A-Za-z_][\w]*)/gim;
  const result = content.replace(regex, (match, indent, tableName, constraintName, offset, fullString) => {
    const before = fullString.slice(Math.max(0, offset - 200), offset);
    const dropRegex = new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${constraintName}\\b`, "i");
    if (dropRegex.test(before)) return match;
    count++;
    return `${indent}ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};\n${indent}ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName}`;
  });
  return { content: result, count };
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const path = join(MIGRATIONS_DIR, file);
  const original = readFileSync(path, "utf8");
  let content = original;
  let fileFixes = 0;

  const steps = [
    { name: "CREATE TABLE", fn: fixCreateTable },
    { name: "CREATE VIEW", fn: fixCreateView },
    { name: "CREATE FUNCTION", fn: fixCreateFunction },
    { name: "CREATE POLICY", fn: fixCreatePolicy },
    { name: "CREATE TRIGGER", fn: fixCreateTrigger },
    { name: "ADD COLUMN", fn: fixAlterAddColumn },
    { name: "ADD CONSTRAINT", fn: fixAlterAddConstraint },
  ];

  const fileLog = [];
  for (const step of steps) {
    const { content: nextContent, count } = step.fn(content);
    if (count > 0) {
      fileLog.push(`${step.name}: ${count}`);
      fileFixes += count;
      content = nextContent;
    }
  }

  if (fileFixes > 0) {
    fixedFiles.push({ file, fixes: fileFixes, log: fileLog });
    totalFixes += fileFixes;
    if (!dryRun) writeFileSync(path, content);
  }
}

console.log(`\n${dryRun ? "[DRY RUN] " : ""}Migration idempotency fixes\n`);
console.log(`Files scanned: ${files.length}`);
console.log(`Files modified: ${fixedFiles.length}`);
console.log(`Total fixes applied: ${totalFixes}\n`);

for (const { file, fixes, log } of fixedFiles) {
  console.log(`${file} (${fixes} fixes)`);
  for (const item of log) console.log(`  - ${item}`);
}
