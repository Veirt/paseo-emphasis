# pi-emphasis for Paseo

A Paseo plugin that renders agent replies written with
[pi-emphasis](https://github.com/johnlindquist/pi-emphasis) markup as native Paseo UI.
The grammar and the ideas are pi-emphasis's (by John Lindquist): `[[Done]]`-style status
pills, icon-headed headings and lead labels, colored bold text, arrows, marks, and tree
lines. This plugin re-thinks them for Paseo's GUI — React Native components, Lucide icons,
and theme tokens instead of terminal colors — and adds the half that pi-emphasis does in
Pi's terminal: teaching agents the format through reply guidance injected at agent creation.

```
[[Investigate]] The build. [[Done 6]] [[Failed 1]] [[Needs you]]

## Result
- **Cause:** the **main loop** dropped a frame.
- **Check:** reload and look at the first pill
```

renders with green, red, warning, and accent pills (rounded chips with Lucide icons), a gauge
icon on the heading, a zap icon on the bold lead-in, accent-colored bold, and colored arrows,
marks, and tree connectors, in both light and dark themes and on compact mobile layouts.

## Reply guidance

The renderer only pays off if replies are written for it, so the plugin also teaches the
format. The guidance encodes what makes agent output readable in a human attention window:

- **Outcome first** — the result in one line of bold, a reader scanning first lines gets
  every outcome (Amp's "what the agent did, not how it got there").
- **Numbers on the chip, causes in the body** — `[[Passed 12/12]]` on the pill.
- **One scan order for reports** — what changed → why → risk → what to check.
- **Uncertainty surfaced** — `[[Observed]]` / `[[Inferred]]` / `[[Unverified]]`; a guess
  inside an affirmative pill reads as a fact.
- **Detail on demand** — commands, logs, and diffs named or behind a heading, never wall-pasted.
- **Native components for data, markup for states** — when the
  [Generative UI plugin](https://github.com/anh-chu/paseo-plugin-genui) is enabled, data-bearing
  parts (tests, logs, findings, metrics, plans, changes) go in its ` ```ui ` blocks, and pills
  keep states, asks, and prose. Data never appears twice.

Delivery:

- **New agents** get the guidance appended to their system prompt at creation when
  **Settings → Plugins → pi-emphasis → Teach new agents the reply format** is on (default
  on). A marker line in the guidance keeps repeated or duplicated configs from stacking a
  second copy.
- **Existing agents**: run `/emphasis [prompt]` in the composer to send the guidance to the
  agent, optionally with your own prompt appended.
- The word lists the guidance teaches come straight from the same vocabulary tables the
  parser colors, so grammar and teaching cannot drift apart.

## Principles

- **Render only.** Stored messages, copied text, and exports keep the original markdown.
  The plugin's copy button copies the message source with `[[...]]` tokens intact. Messages
  without emphasis markup are never replaced: they keep Paseo's own renderer.
- **No model calls, no network calls.** The guidance is static text added at agent creation
  or sent by you through `/emphasis`; the plugin never calls a model or the network itself.

## Development

Requires [bun](https://bun.sh) and a Paseo daemon (>=0.16.0) with plugins enabled.

```bash
bun install
bun run typecheck   # tsc --noEmit
bun test            # parser + guidance tests
bun run lint        # oxlint
bun run format      # oxfmt --write
```

Install into your local daemon from this checkout (runtime id stays `emphasis`) and watch
its logs:

```bash
paseo plugin install /absolute/path/to/paseo-emphasis
paseo plugin ls
paseo plugin logs emphasis
cd client/ && rg -n "document\\.|window\\.|className=|onClick=|<[a-z]+[ >]" . # mobile audit: no hits expected
```

## How it works

The client registers a timeline transformer for the `assistant_message` item type. If a
message contains any construct the plugin decorates, the transformer parses it into blocks
and replaces the item; otherwise it returns `undefined` and Paseo renders the message as
usual. The renderer validates the transformed data with Zod, draws decorated lines with
React Native primitives, and delegates plain paragraphs and fenced code to the host
`Markdown` component. While a reply streams, decorated text uses the host `StreamedText`
for paced reveal.

The server entry registers the plugin settings and a `agent.create.before` hook that appends
the reply guidance (`shared/instructions.ts`) to the new agent's `systemPrompt` when
`autoInstructions` is on and the marker is absent.

## Credits

- [pi-emphasis](https://github.com/johnlindquist/pi-emphasis) by John Lindquist (MIT) — the
  grammar, the pill idea, and the reply-guidance approach. Vocabulary tables are ported
  verbatim; the parser is a faithful port of its matching and icon rules.
- [anh-chu/paseo-plugin-genui](https://github.com/anh-chu/paseo-plugin-genui) (itself ported
  from ComicBit/bb-plugin-genui) — the reference for Paseo's guidance-at-creation, settings,
  and slash-command patterns. For rich generative answers (charts, forms, maps), use genui;
  this plugin keeps replies lightweight and text-safe.

## License

MIT
