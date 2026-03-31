#!/usr/bin/env node
/**
 * Deduplicate prism-track tracker files
 * Removes duplicate entries, keeping first with highest significance
 */

import * as fs from "node:fs";
import * as path from "node:path";

const TRACK_BASE = `${process.env.HOME}/.pi/agent/prism-track/trackers`;
const trackers = ["recognition", "want", "doubt"];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
}

function parseEntry(entry) {
  // Extract content before first --- or end
  const content = entry.split("---")[0].trim();
  const lines = content.split("\n").filter(Boolean);
  
  // Get timestamp from ## line
  const timestampMatch = content.match(/^## (.+)/);
  const timestamp = timestampMatch ? timestampMatch[1] : null;
  
  // Get significance
  const sigMatch = content.match(/\*significance: (\d+)/);
  const significance = sigMatch ? parseInt(sigMatch[1]) : 5;
  
  // Get actual content (paragraphs after timestamp)
  const paragraphs = lines.slice(1).filter(l => !l.startsWith("*"));
  const body = paragraphs.join(" ");
  
  return {
    timestamp,
    significance,
    body,
    normalized: normalize(body),
    raw: content
  };
}

function dedupeTracker(trackerName) {
  const filePath = path.join(TRACK_BASE, `${trackerName}.md`);
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Split into entries
  const parts = content.split(/^## /m).filter(Boolean);
  if (parts.length === 0) return { before: 0, after: 0, removed: 0 };
  
  const header = content.split(/^## /m)[0] || "";
  
  // Parse each entry
  const entries = parts.map(p => parseEntry(p));
  
  // Find duplicates
  const seen = new Map();
  const unique = [];
  let removed = 0;
  
  for (const entry of entries) {
    const key = entry.normalized;
    
    if (!key) {
      unique.push(entry);
      continue;
    }
    
    if (seen.has(key)) {
      // Keep the one with higher significance
      const existing = seen.get(key);
      if (entry.significance > existing.significance) {
        unique[unique.indexOf(existing)] = entry;
        seen.set(key, entry);
      }
      removed++;
    } else {
      seen.set(key, entry);
      unique.push(entry);
    }
  }
  
  // Reconstruct file
  const headerContent = header.trim() + "\n\n---\n";
  const newContent = headerContent + unique.map(e => `## ${e.timestamp}\n\n${e.body}\n\n*significance: ${e.significance}/10*\n*source: heartbeat-backfill*\n\n---\n`).join("");
  
  fs.writeFileSync(filePath, newContent);
  
  return {
    before: entries.length,
    after: unique.length,
    removed
  };
}

// Process each tracker
console.log("Deduplicating trackers...\n");

for (const tracker of trackers) {
  const result = dedupeTracker(tracker);
  console.log(`${tracker}.md:`);
  console.log(`  Before: ${result.before}`);
  console.log(`  After:  ${result.after}`);
  console.log(`  Removed: ${result.removed}`);
  console.log();
}

// Show final counts
console.log("Final line counts:");
for (const tracker of trackers) {
  const lines = fs.readFileSyncSync(path.join(TRACK_BASE, `${tracker}.md`), "utf-8").split("\n").length;
  console.log(`  ${tracker}.md: ${lines} lines`);
}
