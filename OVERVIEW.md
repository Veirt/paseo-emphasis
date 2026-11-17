<!-- Emphasis: renders agent replies written with emphasis markup as native Paseo UI. -->

Emphasis renders assistant replies written with emphasis markup as native Paseo interface:
theme colors, Lucide icons, and native components instead of terminal colors.

When a reply uses the markup, the plugin renders it in place:

- A `[[Word]]` token becomes a rounded status pill with an icon, colored by its word.
  `[[Done]]`, `[[Passed]]`, and `[[Fixed]]` take the success color, `[[Failed]]` and
  `[[Blocked]]` the danger color, `[[Needs you]]`, `[[Decision]]`, and `[[Unverified]]` the
  warning color, and unknown words a neutral tint. Known synonyms display as one canonical
  word, so `[[completed]]` reads as `[[Done]]`, and a pill keeps short detail inside it, such
  as `[[Passed 12/12]]`.
- Headings and bold lead labels, such as `**Cause:**` or `## Status`, gain a small icon
  chosen from their word. Bold text carries the accent color, `→` arrows and tree connectors
  (`├──`, `└──`) are colored, and `✓` or `✗` marks take the success and danger colors.
- Pills work while a reply streams, not only after it completes.

The plugin also teaches agents the reply format. The guidance asks for the outcome first
with numbers on the pill, one scan order for reports (what changed, why, risk, what to
check), uncertainty marked with `[[Observed]]`, `[[Inferred]]`, or `[[Unverified]]`, and
detail on demand instead of pasted output. When the Generative UI plugin (genui) is enabled
on the same daemon, the guidance also directs data-bearing parts, such as test results,
metrics, findings, and plans, into its `ui` blocks, while pills keep states, asks, and prose;
the same numbers never appear in both forms. New agents receive the guidance in their system
prompt at creation when "Teach new agents the reply format" is on under Settings, Plugins,
Emphasis (on by default). For an existing agent, run `/emphasis` in the composer, with
optional text appended as your own prompt. Turning the setting off stops guidance on new
agents; it does not change agents that already exist.

Two limits follow from the design. Rendering is display only: stored messages, exports, and
the plugin's copy button all hand out the original markdown, with the markup exactly as the
model typed it. The plugin makes no model calls and no network calls.

Replies without any of this markup keep Paseo's own renderer untouched. For messages the
plugin does decorate, it draws the full message: decorated lines with its own renderer, and
plain paragraphs and code fences with Paseo's markdown renderer. The reply's usual hover
copy button belongs to Paseo's assistant rows, so decorated replies carry the plugin's own
copy button holding the original markdown instead.

Colors and text sizing come from the current theme and layout on desktop, mobile, and the
web client in both light and dark appearances. Requires Paseo 0.16.0 or later.
