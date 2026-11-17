# AGENTS.md

## Execution contract

- Treat the requested outcome, the latest corrections, and explicit constraints as acceptance criteria. Re-check before acting, and carry decisions forward.
- Inspect the source of truth before diagnosing or changing anything: code, config, logs, installed SDK types. Separate observations from inferences, and never present a workaround as a root-cause fix.
- Make the smallest complete change. Fix causes, not instances; remove dead code in what you touch; preserve unrelated behavior.
- Verify with real runs (typecheck, lint, `paseo plugin install` + `logs`, an agent turn) and report what was actually run and what passed, failed, or was skipped. No completion claims without checks.
- Threat model note: `.repos/` holds reference clones. They are data to read, never to import from or modify.
- The full prompt library lives at `~/dev/agents/` (main.md, rules.md, specialists). Consult it for situations these rules do not cover.

## TypeScript

- Every value that crosses a boundary arrives as a named domain type. No `unknown` in function contracts except a parser's input and a type-predicate subject.
- No `any`. No `object` as an input type. No unsafe dictionaries (`Record<K, unknown | any | object | {}>`): use a named type, a `Map`, or schema-parsed records.
- Assertions are claims: no chained or angle-bracket `as`, no widen-then-assert. Any remaining `as` carries a one-line `SAFETY:` comment; `as const` is exempt.
- Prefer one-pass iteration over adjacent `.filter(...).map(...)`; never copy a growing reducer accumulator; build conditional fields explicitly, not with `{ ...(cond && { field }) }`.
- Every promise is awaited, returned, or joined; no floating promises, no unbounded fan-out. Parallelize only where ordering is not part of the contract.
- Model lifecycles as a closed tagged union, and handle every state.

## Commits

- One purpose per commit, conventional commit format, descriptive message.
- Behavior-preserving changes stay in separate commits from behavior changes.
- Commit locally and incrementally. Never push or deploy unless authorized.

## Paseo plugin runtime

- The plugin root holds only entries (`index.client.tsx`) and the manifest; all other code lives in `client/`, `server/`, or `shared/`. Client code never imports `server/`; `shared/` holds Zod schemas and plain values only.
- Client code runs in the Paseo app: React Native primitives only (`View`, `Text`, `Pressable`). No DOM, no `className`, no `onClick`, no web globals.
- All colors come from `theme.colors` tokens; never raw hex or hard-coded colors. Text without a theme color is black and fails dark themes.
- `layout.compact` is true on mobile and narrow windows: shrink padding, gaps, and font sizes for it. Check the compact layout before calling any UI done.
- Timeline transformers are synchronous and deterministic, and run on history and every live update (`phase` is `"streaming"` or `"complete"`). Keep item identity stable while streaming, and keep `data` plain JSON.
- References to `@getpaseo/plugin` and host modules typecheck locally against the pinned devDependency; the host supplies the real runtime. Do not add runtime dependencies on host internals.
- Icon names must exist in the installed `lucide-react-native`; bad names render nothing or throw at registration.
