import type { EmphasisTone } from "./emphasis";

/**
 * The emphasis grammar: `core` are the words agents are taught to write; `also`
 * are accepted and colored the same.
 */
export const VOCABULARY: Record<
  Exclude<EmphasisTone, "neutral">,
  { core: string[]; also: string[] }
> = {
  error: {
    core: ["Failed", "Blocked", "Broken", "Unsafe"],
    also: ["fail", "failing", "error", "rejected", "down"],
  },
  warning: {
    core: [
      "Needs you",
      "Decision",
      "Unverified",
      "Partial",
      "Skipped",
      "In progress",
      "Pending",
      "At risk",
    ],
    also: ["needs review", "waiting", "review", "todo", "stale", "draft"],
  },
  success: {
    core: ["Done", "Passed", "Observed", "Fixed", "Live", "Recommended", "Keep"],
    also: [
      "pass",
      "ready",
      "merged",
      "safe",
      "verified",
      "shipped",
      "ok",
      "approved",
      "complete",
      "completed",
      "finished",
      "healthy",
    ],
  },
  danger: { core: ["Costs money", "Destructive", "Irreversible"], also: [] },
  mode: { core: ["Brainstorm", "Investigate", "Preview", "Implement", "Qualify"], also: [] },
  owner: { core: ["Owned", "Shared", "Foreign"], also: [] },
};

/** Neutral soft-blue words that still carry an icon. */
export const CONTEXT_WORDS = ["Inferred", "New", "Changed", "Optional"];
