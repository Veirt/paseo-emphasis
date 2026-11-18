import { CONTEXT_WORDS, VOCABULARY } from "./vocabulary";

function pills(words: readonly string[]): string {
  return words.map((word) => `[[${word}]]`).join(" ");
}

/**
 * The marker inside the reply-format guidance, so a re-created or duplicated agent config
 * never stacks a second copy.
 */
export const EMPHASIS_MARKER = "[paseo-emphasis]";

/**
 * The reply format agents are taught in their system prompt at agent creation. It is derived
 * from research into how agent output meets a human attention window: the outcome first with
 * numbers on the chip, one scan order for reports, uncertainty surfaced, and detail on demand.
 * The word lists come straight from `VOCABULARY`.
 */
export function buildFullInstructions(): string {
  return `${EMPHASIS_MARKER} reply-format guidance from the Emphasis plugin for Paseo.

# Reply format

These rules shape replies written to the user in Paseo. The Emphasis plugin renders them as
native interface: a \`[[Word]]\` pill becomes a colored chip with an icon, a known \`##\` heading
gains an icon from its word, an action ask (\`**Do:**\`, \`**Next:**\`, \`**Check:**\`, \`**Fix:**\`,
\`**Unblock:**\`, \`**See:**\`) becomes an action badge, \`setup → build → test\` becomes a stepper,
\`▰▰▱▱▱\` becomes a progress bar, and \`├──\` runs become an aligned panel. Standard Markdown
(links, inline code, nested lists, quotes, bold) renders natively. Copying and exporting keep
the plain markdown.

- **Outcome first.** Open every reply with the result in one line of bold: what changed and
  its state. A reader scanning only the first lines still gets every outcome. A one-line
  answer stays one line.
- **Numbers on the chip, causes in the body.** A pill may carry a count: [[Passed 12/12]].
  A long report opens with a scoreboard line: [[Done 6]] [[Failed 1]] [[Needs you 1]]. The
  cause gets the next line, not the chip.
- **Pills are required, exact words.** One state, one pill; never invent status words.
  Settled: ${pills(VOCABULARY.success.core)}. Wrong: ${pills(VOCABULARY.error.core)}.
  Waiting on the reader: ${pills(VOCABULARY.warning.core)}. Consequences, always before the
  action and with the amount or what is lost: ${pills(VOCABULARY.danger.core)}. The first
  substantive line opens with the kind of work: ${pills(VOCABULARY.mode.core)}. Changed
  outside this task's own files: ${pills(VOCABULARY.owner.core)}. Anything else short stays
  neutral: ${pills(CONTEXT_WORDS)}.
- **Place pills for clean scanning.** Put pills on a scoreboard line, at the start of a
  bullet or block, or inside a table cell. Do not bury multiple pills inside one long
  run-on paragraph; split [[Observed]] and [[Unverified]] onto separate bullets when both
  list multiple items.
- **Mark what you did not verify.** [[Observed]] saw it in the real system. [[Inferred]]
  reasoned from other signals, and says from what. [[Unverified]] did not check: name the
  fastest check instead of writing an affirmative pill. A guess inside an affirmative chip
  reads as a fact.
- **Every waiting or wrong pill carries its ask**, on its own line or sub-bullet, opening
  with a bold lead-in ending in a colon: **Do:** the exact action and what it unblocks.
  **Next:** what you are doing about a failure. **Unblock:** the smallest thing that
  unblocks. **Check:** the fastest check for an unverified claim. **See:** where the result
  is visible. Never tack an ask onto the end of a long paragraph.
- **A report runs in one order.** What changed → why → risk → what to check, one bold lead
  label each. Repeat every [[Needs you]] and [[Decision]] on a closing line of a long reply.
- **Native components for data, markup for states.** When the Generative UI plugin is enabled
  and its \`ui\` reference is in your instructions, write data-bearing parts as \`\`\`ui blocks
  (Tests, Logs, Findings, Metric, Table, Plan, Decision, Changes) and keep the pills and
  labels above for statuses, asks, and prose. Never state the same numbers twice, once in a
  block and once in text.
- **Detail on demand, not inline.** Commands, logs, diffs, and long output are named in one
  line or placed behind a heading; the reader expands what they need. Never paste a wall of
  output into the reply.
- **Bold sparingly.** Bold the terms that carry the point, not every noun. Keep pills and
  markup out of code, paths, commands, and exact output; write plain markdown when asked for
  plain text.

Rich inline components follow the Generative UI plugin when it is enabled.`;
}
