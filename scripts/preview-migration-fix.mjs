#!/usr/bin/env node
// Preview a single migration's transformation without writing.
// Usage: node scripts/preview-migration-fix.mjs <filename>

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/preview-migration-fix.mjs <filename>");
  process.exit(1);
}

function fixCreatePolicy(content) {
  const regex = /^([ \t]*)CREATE\s+POLICY\s+("[^"]+"|[A-Za-z_][\w]*)\s+ON\s+([A-Za-z_][\w.]*)/gim;
  return content.replace(regex, (match, indent, policyName, tableName) => {
    return `${indent}DROP POLICY IF EXISTS ${policyName} ON ${tableName};\n${indent}CREATE POLICY ${policyName} ON ${tableName}`;
  });
}

function fixCreateTrigger(content) {
  const regex = /^([ \t]*)CREATE\s+TRIGGER\s+([A-Za-z_][\w]*)\s+([\s\S]*?ON\s+([A-Za-z_][\w.]*))/gim;
  return content.replace(regex, (match, indent, triggerName, rest, tableName) => {
    return `${indent}DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${indent}CREATE TRIGGER ${triggerName} ${rest}`;
  });
}

function fixCreateView(content) {
  return content.replace(/^([ \t]*)CREATE\s+VIEW\s+/gim, "$1CREATE OR REPLACE VIEW ");
}

function fixCreateFunction(content) {
  return content.replace(/^([ \t]*)CREATE\s+FUNCTION\s+/gim, "$1CREATE OR REPLACE FUNCTION ");
}

function fixCreateTable(content) {
  return content.replace(/^([ \t]*)CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gim, "$1CREATE TABLE IF NOT EXISTS ");
}

function fixAlterAddColumn(content) {
  return content.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)([A-Za-z_])/gim, "ADD COLUMN IF NOT EXISTS $1");
}

function fixAlterAddConstraint(content) {
  const regex = /^([ \t]*)ALTER\s+TABLE\s+(?:ONLY\s+)?([A-Za-z_][\w.]*)\s+ADD\s+CONSTRAINT\s+([A-Za-z_][\w]*)/gim;
  return content.replace(regex, (match, indent, tableName, constraintName) => {
    return `${indent}ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};\n${indent}ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName}`;
  });
}

const path = join(MIGRATIONS_DIR, file);
const original = readFileSync(path, "utf8");
let content = original;
content = fixCreateTable(content);
content = fixCreateView(content);
content = fixCreateFunction(content);
content = fixCreatePolicy(content);
content = fixCreateTrigger(content);
content = fixAlterAddColumn(content);
content = fixAlterAddConstraint(content);

console.log(content);
