# Emphasis for Paseo

[Emphasis](https://paseo.sh) is a Paseo plugin that renders agent replies written with
[pi-emphasis](https://github.com/johnlindquist/pi-emphasis) markup: `[[Done]]`-style status
pills, icon-headed headings and lead labels, colored bold text, arrows, and tree lines.
It is a port of pi-emphasis to Paseo's native UI (React Native, Lucide icons, theme tokens),
not ANSI or Nerd Font glyph rendering.

```
[[Investigate]] The build. [[Done 6]] [[Failed 1]] [[Needs you]]

## Result
- **Cause:** the **main loop** dropped a frame.
- step one → step two ✓
  ├── build
  └── test
```

renders with green, red, and warning pills (rounded chips with Lucide icons), a gauge icon on
the heading, a zap icon on the bold lead-in, accent-colored bold, and colored arrows, marks,
and tree connectors, in both light and dark themes and on compact mobile layouts.

## Principles

- **Render only.** Stored messages, copied text, and exports keep the original markdown.
  The plugin's copy button copies the message source with `[[...]]` tokens intact. Messages
  without emphasis markup are never replaced: they keep Paseo's own renderer.
- **No model calls, no network calls.** The plugin never prompts the agent or teaches it to
  write this markup; it only decorates markup that is already there.

## Development

Requires [bun](https://bun.sh) and a Paseo daemon (>=0.16.0) with plugins enabled.

```bash
bun install
bun run typecheck   # tsc --noEmit
bun test            # parser tests
bun run lint        # oxlint
bun run format      # oxfmt --write
```

Install into your local daemon from this checkout and watch its logs:

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

## License

MIT
