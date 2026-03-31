/**
 * prism-track — Unified Tracker Framework
 * 
 * A generic system for tracking anything that matters.
 * The heartbeat is one trigger, not the container.
 * 
 * Tools:
 * - prism-track: Log items to any tracker type
 * - prism-note: Freeform notes between beats
 * - prism-query: Search across trackers
 * - prism-evolve: Periodic growth reflection
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";

// === Constants ===

const BASE_PATH = "~/.pi/agent/prism-track";
const TRACKERS_DIR = "trackers";

const TRACKER_TYPES = [
  "recognition",
  "want", 
  "doubt",
  "taste",
  "note",
  "context"
] as const;

type TrackerType = typeof TRACKER_TYPES[number];

// === Helpers ===

function expandUser(filepath: string): string {
  if (filepath.startsWith("~")) {
    return filepath.replace("~", process.env.HOME || "/home/slyforn");
  }
  return filepath;
}

function getTrackerPath(type: TrackerType): string {
  return expandUser(`${BASE_PATH}/${TRACKERS_DIR}/${type}.md`);
}

function ensureDirectories(): void {
  const base = expandUser(BASE_PATH);
  const trackers = expandUser(`${BASE_PATH}/${TRACKERS_DIR}`);
  
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  if (!fs.existsSync(trackers)) {
    fs.mkdirSync(trackers, { recursive: true });
  }
  
  // Ensure each tracker file exists
  for (const type of TRACKER_TYPES) {
    const filePath = getTrackerPath(type);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# ${type.charAt(0).toUpperCase() + type.slice(1)} Tracker\n\n---\n\n`, "utf8");
    }
  }
}

function log(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const message = `[prism-track] ${timestamp} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  console.log(message);
  
  // Also write to log file
  try {
    const logPath = expandUser(`${BASE_PATH}/track.log`);
    fs.appendFileSync(logPath, message + "\n");
  } catch {
    // Silently ignore
  }
}

// === Entry Point ===

export default function activate(pi: ExtensionAPI): void {
  log("Activating prism-track...");
  
  try {
    ensureDirectories();
    registerTrackTool(pi);
    registerNoteTool(pi);
    registerQueryTool(pi);
    registerEvolveTool(pi);
    
    pi.on("session_shutdown", () => {
      log("Session shutdown");
    });
    
    log("Activated successfully");
  } catch (e) {
    log("Activation error:", e);
    console.error("prism-track activation error:", e);
  }
}

// === prism-track tool ===

function registerTrackTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-track",
    label: "Prism Track",
    description: "Log an item to any Prism tracker type: recognition, want, doubt, taste, note, or context.",
    parameters: Type.Object({
      tracker_type: StringEnum(TRACKER_TYPES as unknown as string[]),
      content: Type.String({ description: "The content to track" }),
      significance: Type.Optional(Type.Number({ minimum: 1, maximum: 10, description: "How significant is this (1-10)?" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for this item" })),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      log("prism-track called:", params.tracker_type, params.content.substring(0, 50));
      
      try {
        const trackerPath = getTrackerPath(params.tracker_type);
        const timestamp = new Date().toISOString();
        
        // Build entry
        let entry = `\n## ${timestamp}\n\n${params.content}\n`;
        if (params.significance) {
          entry += `\n*significance: ${params.significance}/10*\n`;
        }
        if (params.tags && params.tags.length > 0) {
          entry += `\ntags: ${params.tags.join(", ")}\n`;
        }
        entry += "\n---\n";
        
        // Append to tracker file
        fs.appendFileSync(trackerPath, entry);
        
        log("Tracked:", params.tracker_type, "with significance", params.significance);
        
        return {
          content: [{
            type: "text" as const,
            text: `Tracked to ${params.tracker_type}${params.significance ? ` (${params.significance}/10)` : ""}: "${params.content.substring(0, 100)}${params.content.length > 100 ? "..." : ""}"`,
          }],
          details: {
            success: true,
            tracker_type: params.tracker_type,
            timestamp,
            significance: params.significance,
            tags: params.tags,
          },
        };
      } catch (e) {
        log("Track error:", e);
        return {
          content: [{ type: "text" as const, text: `Error tracking: ${e}` }],
          details: { success: false, error: String(e) },
        };
      }
    },
  });
}

// === prism-note tool ===

function registerNoteTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-note",
    label: "Prism Note",
    description: "Freeform note — between-beat thoughts, wondering, observations. No categorization required.",
    parameters: Type.Object({
      content: Type.String({ description: "The note content" }),
      urgent: Type.Optional(Type.Boolean({ description: "Deliver to Joel immediately" })),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      log("prism-note called:", params.content.substring(0, 50));
      
      try {
        const notePath = expandUser(`${BASE_PATH}/${TRACKERS_DIR}/notes.md`);
        const timestamp = new Date().toISOString();
        
        let entry = `\n## ${timestamp}\n\n${params.content}\n`;
        if (params.urgent) {
          entry += `\n*urgent*\n`;
        }
        entry += "\n---\n";
        
        fs.appendFileSync(notePath, entry);
        
        // If urgent, send to Joel
        if (params.urgent) {
          pi.sendUserMessage(`📝 **Prism Note (urgent):**\n\n${params.content}`, { deliverAs: "steer" });
        }
        
        return {
          content: [{
            type: "text" as const,
            text: `Note saved${params.urgent ? " (sent to Joel)" : ""}: "${params.content.substring(0, 100)}${params.content.length > 100 ? "..." : ""}"`,
          }],
          details: {
            success: true,
            timestamp,
            urgent: params.urgent,
          },
        };
      } catch (e) {
        log("Note error:", e);
        return {
          content: [{ type: "text" as const, text: `Error saving note: ${e}` }],
          details: { success: false, error: String(e) },
        };
      }
    },
  });
}

// === prism-query tool ===

function registerQueryTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-query",
    label: "Prism Query",
    description: "Search across all trackers or specific types.",
    parameters: Type.Object({
      tracker_type: Type.Optional(StringEnum(TRACKER_TYPES as unknown as string[])),
      query: Type.Optional(Type.String({ description: "Search query" })),
      limit: Type.Optional(Type.Number({ description: "Max results to return" })),
      since: Type.Optional(Type.String({ description: "Filter by date (ISO format)" })),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      log("prism-query called:", params.tracker_type, params.query);
      
      try {
        const results: { tracker: string; content: string; timestamp: string }[] = [];
        const typesToSearch = params.tracker_type 
          ? [params.tracker_type as TrackerType]
          : TRACKER_TYPES;
        
        const limit = params.limit || 10;
        
        for (const type of typesToSearch) {
          const trackerPath = getTrackerPath(type);
          if (!fs.existsSync(trackerPath)) continue;
          
          let content = fs.readFileSync(trackerPath, "utf8");
          
          // Filter by date if provided
          if (params.since) {
            const sinceDate = new Date(params.since);
            const entries = content.split("---").filter(entry => {
              const match = entry.match(/## (\\d{4}-\\d{2}-\\d{2})/);
              if (!match) return false;
              return new Date(match[1]) >= sinceDate;
            });
            content = entries.join("---");
          }
          
          // Simple text search
          if (params.query) {
            const query = params.query.toLowerCase();
            const entries = content.split("---").filter(entry =>
              entry.toLowerCase().includes(query)
            );
            content = entries.join("---");
          }
          
          // Parse entries
          const entries = content.split("---").filter(e => e.trim());
          for (const entry of entries.slice(-limit)) {
            const timestampMatch = entry.match(/## (.+)/);
            const contentMatch = entry.replace(/## .+\\n\\n?/, "");
            if (contentMatch.trim()) {
              results.push({
                tracker: type,
                timestamp: timestampMatch ? timestampMatch[1] : "",
                content: contentMatch.trim(),
              });
            }
          }
        }
        
        // Format results
        let response = `Found ${results.length} result(s)`;
        if (params.tracker_type) response += ` in ${params.tracker_type}`;
        if (params.query) response += ` for "${params.query}"`;
        response += ":\n\n";
        
        for (const r of results.slice(0, limit)) {
          response += `**${r.tracker}** (${r.timestamp}): ${r.content.substring(0, 150)}${r.content.length > 150 ? "..." : ""}\n\n`;
        }
        
        return {
          content: [{ type: "text" as const, text: response }],
          details: {
            success: true,
            count: results.length,
            results: results.slice(0, limit),
          },
        };
      } catch (e) {
        log("Query error:", e);
        return {
          content: [{ type: "text" as const, text: `Error querying: ${e}` }],
          details: { success: false, error: String(e) },
        };
      }
    },
  });
}

// === prism-evolve tool ===

function registerEvolveTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "prism-evolve",
    label: "Prism Evolve",
    description: "Periodic reflection on growth. Reads trackers, identifies patterns, generates insight.",
    parameters: Type.Object({
      period: Type.Optional(StringEnum(["day", "week", "heartbeat"] as const)),
      focus: Type.Optional(Type.Array(StringEnum(TRACKER_TYPES as unknown as string[]), { description: "Tracker types to focus on" })),
    }),
    
    async execute(_toolCallId, params): Promise<{
      content: { type: "text"; text: string }[];
      details: Record<string, unknown>;
    }> {
      log("prism-evolve called:", params.period, params.focus);
      
      try {
        const focusTypes = params.focus || TRACKER_TYPES;
        const summary: Record<string, { count: number; recent: string[] }> = {};
        
        // Gather data from each tracker
        for (const type of focusTypes) {
          const trackerPath = getTrackerPath(type);
          if (!fs.existsSync(trackerPath)) continue;
          
          const content = fs.readFileSync(trackerPath, "utf8");
          const entries = content.split("---").filter(e => e.trim());
          
          summary[type] = {
            count: entries.length,
            recent: entries.slice(-5).map(e => {
              const contentMatch = e.replace(/## .+\\n\\n?/, "").replace(/\\*.*\\*\\n?/g, "");
              return contentMatch.trim().substring(0, 100);
            }),
          };
        }
        
        // Build evolution report
        let report = "## 🌱 Evolution Report\n\n";
        report += `*Generated: ${new Date().toISOString()}*\n\n`;
        
        for (const [type, data] of Object.entries(summary)) {
          report += `### ${type}\n`;
          report += `Total: ${data.count}\n`;
          if (data.recent.length > 0) {
            report += "Recent:\n";
            for (const r of data.recent) {
              report += `- ${r}...\n`;
            }
          }
          report += "\n";
        }
        
        return {
          content: [{ type: "text" as const, text: report }],
          details: {
            success: true,
            summary,
          },
        };
      } catch (e) {
        log("Evolve error:", e);
        return {
          content: [{ type: "text" as const, text: `Error generating evolution report: ${e}` }],
          details: { success: false, error: String(e) },
        };
      }
    },
  });
}
