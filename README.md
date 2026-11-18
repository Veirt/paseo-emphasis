# paseo-emphasis

A Paseo plugin that renders agent replies as native UI.

```
[[Investigate]] The build. [[Done 6]] [[Failed 1]] [[Needs you]]

## Result
- **Cause:** the **main loop** dropped a frame.
- **Check:** reload and look at the first pill
```

## Markup

- **Pills** `[[Done]]`, `[[Passed 12/12]]`: colored chips with an icon and tone from the word; counts and ratios draw a mini bar. Unknown words become neutral chips, so markup never leaks as literal text.
- **Headings** `## Done`: known words take an icon in the gutter.
- **Lead labels** `**Next:** install the deps`: an icon-bearing bold lead-in renders as a badge; the rest of the line stays normal text.
- **Tables**: GFM tables become native grids with delimiter alignment. Cells go through the same pipeline, so pills and bold work inside them.
- **Steppers** `setup → build → test`: chains of short words draw as chips joined by chevrons, with marks attaching to their step.
- **Trees**: `├──` and `└──` runs render as one aligned monospace panel.
- **Gauges** `▰▰▱▱▱`: real bars, colored by how full they are.
- **Marks** `✓` `✗` `→`: colored pass, fail, and arrows.
- **Fences and plain paragraphs** stay with the host markdown renderer.

## Reply guidance

Replies are taught the grammar two ways:

- New agents get it appended to their system prompt at creation when **Settings → Plugins → Emphasis → Teach new agents the reply format** is on.
- Any agent gets it when you run `/emphasis` in the composer; text after it is sent along as a prompt.

The guidance asks for the outcome first, numbers on the chip, the cause in the body, one scan order for reports, and uncertainty named. The word lists it teaches come from the same tables the parser colors, so they cannot drift apart.

## How it works

The client registers a timeline transformer for `assistant_message`. It parses a message into blocks (chunk, markdown, table), plans each block's layout under a no-view-in-text rule, and draws it with React Native primitives. The parser is an explicit state machine, so a new markdown construct is a compile error until some transition handles it. Data is render-only: the original markdown travels in the item and the copy button hands it out intact.

The server entry registers the settings and an `agent.create.before` hook that appends the guidance when `autoInstructions` is on.

## Development

Requires [bun](https://bun.sh) and a Paseo daemon (>=0.16.0) with plugins enabled.

```bash
bun install
bun run typecheck
bun test
bun run lint
bun run format
```

## Credits

- [pi-emphasis](https://github.com/johnlindquist/pi-emphasis) by John Lindquist (MIT): the pill idea and the reply-guidance approach.

- [paseo-plugin-genui](https://github.com/anh-chu/paseo-plugin-genui): the reference for Paseo's guidance-at-creation, settings, and slash-command patterns. Use genui for rich generative answers (charts, forms, maps); this plugin keeps replies lightweight and text-safe.
