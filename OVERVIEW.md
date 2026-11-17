<!-- Emphasis for Paseo renders replies written with pi-emphasis markup. -->

Emphasis makes assistant replies easier to scan in Paseo. It is a port of pi-emphasis for the Pi CLI, rebuilt for Paseo's interface.

When an assistant reply uses pi-emphasis markup, Emphasis renders it with native Paseo UI:

- A `[[Word]]` token becomes a rounded status pill with an icon, colored by its word. `[[Done]]`, `[[Passed]]`, and `[[Fixed]]` are green, `[[Failed]]` and `[[Blocked]]` are red, `[[Needs you]]`, `[[Decision]]`, and `[[Unverified]]` carry the warning color, and mode words such as `[[Investigate]]` use the theme accent. Known synonyms display as one canonical word, so `[[completed]]` reads as `[[Done]]`, and short detail is kept inside the pill, such as `[[Passed 12/12]]`.
- Headings and bold lead labels, such as `**Cause:**` or `## Status`, gain a small icon chosen from their word.
- Bold text carries the accent color, `→` arrows and tree connectors (`├──`, `└──`) are colored, and `✓` or `✗` marks take the success and danger colors.
- Pills work while a reply streams, not only after it completes.

Rendering is display only. Stored messages, exports, and the plugin's copy button all hand out the original markdown, with `[[Done]]` written exactly as the model typed it. The plugin makes no model calls and no network calls.

Messages that contain none of this markup keep Paseo's own renderer untouched. For messages it does decorate, the plugin draws the full message: decorated lines with its own renderer, and plain paragraphs and code fences with Paseo's markdown renderer. One limit follows from that: the reply's usual hover copy button belongs to Paseo's assistant rows, so decorated replies carry the plugin's own copy button holding the original markdown instead.

Colors and text sizing come from the current theme and layout on desktop, mobile, and the web client in both light and dark appearances. Requires Paseo `>=0.16.0`.
