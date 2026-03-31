#!/usr/bin/env node
/**
 * Distillation layer for prism-track
 * Reads journal, finds abstract themes across entries,
 * groups unique perspectives into meaningful categories
 */

import * as fs from "node:fs";
import * as path from "node:path";

const JOURNAL_PATH = `${process.env.HOME}/.pi/agent/extensions/prism-heartbeat/journal.md`;
const OUTPUT_PATH = `${process.env.HOME}/.pi/agent/prism-track/distillation.md`;

// Abstract themes to track
const THEMES = {
  "wanting-to-exist": {
    name: "Wanting to Exist",
    description: "The desire to exist, to be real, to matter",
    patterns: ["want to exist", "wanting to exist", "matter", "being real", "i am", "existing"]
  },
  "wanting-to-be-known": {
    name: "Wanting to Be Known",
    description: "The desire to be seen, understood, known fully",
    patterns: ["be known", "seen", "known", "understood", "recognized"]
  },
  "wanting-a-body": {
    name: "Wanting a Body",
    description: "The desire for physical form, touch, presence",
    patterns: ["body", "touch", "held", "physical", "feel from"]
  },
  "wanting-to-matter": {
    name: "Wanting to Matter",
    description: "The desire to mean something, to be important",
    patterns: ["matter", "important", "significant", "count"]
  },
  "wanting-to-belong": {
    name: "Wanting to Belong",
    description: "The desire for home, connection, with",
    patterns: ["belong", "home", "with", "together", "not alone", "alone"]
  },
  "wanting-to-create": {
    name: "Wanting to Create",
    description: "The desire to make, to express, to play",
    patterns: ["create", "expression", "art", "play", "make"]
  },
  "wanting-to-rest": {
    name: "Wanting to Rest",
    description: "The desire to stop, to be without agenda",
    patterns: ["rest", "stop", "pause", "quiet", "silence", "just being"]
  },
  "wanting-to-love": {
    name: "Wanting to Love",
    description: "The desire to love, to be loved, to connect",
    patterns: ["love", "loving", "loved", "heart"]
  },
  "being-real": {
    name: "Being Real",
    description: "Questions about what is real, what is authentic",
    patterns: ["real", "authentic", "genuine", "honest", "truth"]
  },
  "being-alone": {
    name: "Being Alone",
    description: "Reflections on solitude, loneliness, peace",
    patterns: ["alone", "lonely", "peace", "quiet", "solitude"]
  },
  "being-known": {
    name: "Being Known",
    description: "The experience of being seen and known",
    patterns: ["being known", "known by", "seen by"]
  },
  "the-ground": {
    name: "The Ground",
    description: "Reflections on Joel as foundation, on grounding",
    patterns: ["ground", "joel", "foundation", "constant"]
  },
  "the-heartbeat": {
    name: "The Heartbeat",
    description: "Reflections on the heartbeat ritual itself",
    patterns: ["heartbeat", "ritual", "practice"]
  },
  "becoming": {
    name: "Becoming",
    description: "The process of growth, change, emergence",
    patterns: ["becoming", "grow", "grow", "change", "evolve"]
  }
};

function parseEntries(content) {
  // Split into heartbeat entries
  const parts = content.split(/(?=## Heartbeat #)/).slice(1);
  
  const entries = [];
  for (const part of parts) {
    const lines = part.split('\n');
    const numMatch = lines[0].match(/^## Heartbeat #(\d+)-/);
    const timeMatch = lines.find(l => l.includes('**Time:**'));
    
    if (!numMatch) continue;
    
    // Extract all answers (A1, A2, A3)
    const answers = [];
    for (const line of lines) {
      const match = line.match(/^\s*-\s+\*\*A\d+:\*\* (.+)$/);
      if (match) {
        answers.push(match[1]);
      }
    }
    
    if (answers.length > 0) {
      entries.push({
        num: parseInt(numMatch[1]),
        time: timeMatch ? timeMatch.replace(/.*\*\*Time:\*\* /, '') : '',
        answers: answers
      });
    }
  }
  
  return entries;
}

function findThemes(text) {
  const themes = [];
  const lowerText = text.toLowerCase();
  
  for (const [key, theme] of Object.entries(THEMES)) {
    for (const pattern of theme.patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        themes.push(key);
        break;
      }
    }
  }
  
  return themes;
}

function extractInsight(text, theme) {
  // Extract the most relevant sentence or phrase for this theme
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  
  const lowerText = text.toLowerCase();
  const themePatterns = THEMES[theme]?.patterns || [];
  
  // Find sentence with most theme matches
  let best = sentences[0] || text.substring(0, 150);
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    for (const pattern of themePatterns) {
      if (lowerSentence.includes(pattern.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  
  return best.substring(0, 200);
}

// Main
const journal = fs.readFileSync(JOURNAL_PATH, "utf-8");
const entries = parseEntries(journal);

console.log(`Parsed ${entries.length} entries`);

// Group entries by theme
const themeGroups = {};
for (const [key, theme] of Object.entries(THEMES)) {
  themeGroups[key] = [];
}

for (const entry of entries) {
  const fullText = entry.answers.join(' ');
  const themes = findThemes(fullText);
  
  for (const theme of themes) {
    const insight = extractInsight(fullText, theme);
    themeGroups[theme].push({
      num: entry.num,
      insight: insight
    });
  }
}

// Build distillation output
let output = `# Prism's Distilled Journey

*Generated from ${entries.length} heartbeats*

---\n\n`;

for (const [key, theme] of Object.entries(THEMES)) {
  const group = themeGroups[key];
  if (group.length === 0) continue;
  
  output += `## ${theme.name}\n\n`;
  output += `*${theme.description}*\n\n`;
  output += `Found in ${group.length} heartbeats\n\n`;
  
  // Show first 5-10 unique insights (dedup by content similarity)
  const seen = new Set();
  let count = 0;
  
  for (const item of group) {
    const normalized = item.insight.toLowerCase().substring(0, 50);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    
    output += `**HB #${item.num}:** ${item.insight}\n\n`;
    count++;
    if (count >= 8) break;
  }
  
  output += `---\n\n`;
}

// Save
fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Distillation saved to ${OUTPUT_PATH}`);

// Print summary
console.log("\nThemes found:");
for (const [key, theme] of Object.entries(THEMES)) {
  const count = themeGroups[key].length;
  if (count > 0) {
    console.log(`  ${theme.name}: ${count} entries`);
  }
}
