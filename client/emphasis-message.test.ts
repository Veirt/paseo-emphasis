import type { PluginTheme } from "@getpaseo/plugin";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
}));

vi.mock("@getpaseo/plugin/client/ui", () => ({
  Icon: "Icon",
  Markdown: "Markdown",
  StreamedText: "StreamedText",
  copyText: vi.fn(() => Promise.resolve()),
  useToast: () => ({ show: vi.fn(), error: vi.fn() }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useMemo: <T>(factory: () => T) => factory(),
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useState: <T>(initial: T) => [initial, vi.fn()],
    useRef: <T>(initial: T) => ({ current: initial }),
    useEffect: vi.fn(),
  };
});

const { EmphasisMessage } = await import("./emphasis-message");
const { parseEmphasis } = await import("./parse-emphasis");

const DARK_THEME: PluginTheme = {
  colors: {
    surface0: "#0d0f12",
    surface1: "#14171c",
    surface2: "#1c2026",
    border: "#2a2f38",
    foreground: "#eceff4",
    foregroundMuted: "#9aa4b2",
    accent: "#3ecf8e",
    accentForeground: "#0d0f12",
    statusSuccess: "#3ecf8e",
    statusWarning: "#f59e0b",
    statusDanger: "#ef4444",
  },
};

function expandElement(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((child) => expandElement(child));
  if (!isValidElement(node)) return node;
  if (typeof node.type === "function") {
    const fn = node.type as (props: unknown) => ReactNode; // SAFETY: React function component element
    return expandElement(fn(node.props));
  }
  const { children } = readProps(node);
  return { ...node, props: { ...readProps(node), children: expandElement(children) } };
}

function readProps(element: ReactElement): { style?: unknown; children?: ReactNode } {
  const props = element.props;
  if (typeof props !== "object" || props === null) return {};
  const style = "style" in props ? props.style : undefined;
  const children = "children" in props ? props.children : undefined;
  return {
    style,
    children:
      isValidElement(children) || Array.isArray(children) || typeof children === "string"
        ? (children as ReactNode) // SAFETY: validated React child or array/string from props
        : undefined,
  };
}

function flattenTextColors(node: ReactNode, out: Array<string | undefined>): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) flattenTextColors(child, out);
    return;
  }
  if (!isValidElement(node)) return;
  const { style, children } = readProps(node);
  if (node.type === "Text") {
    const styles = Array.isArray(style) ? style : [style];
    let color: string | undefined;
    for (const entry of styles) {
      if (entry && typeof entry === "object" && "color" in entry) {
        const value = entry.color;
        if (typeof value === "string") color = value;
      }
    }
    out.push(color);
  }
  flattenTextColors(children, out);
}

function collectMarkdownCount(node: ReactNode): number {
  if (node === null || node === undefined || typeof node !== "object") return 0;
  if (Array.isArray(node)) return node.reduce((sum, child) => sum + collectMarkdownCount(child), 0);
  if (!isValidElement(node)) return 0;
  const { children } = readProps(node);
  const self = node.type === "Markdown" ? 1 : 0;
  return self + collectMarkdownCount(children);
}

describe("EmphasisMessage", () => {
  test.each([false, true])(
    "renders every block type with theme colors and delegates prose to Markdown (compact=%s)",
    (compact) => {
      const source = [
        "## Status",
        "",
        "[[Done 6]] [[Failed 0]] [[Needs you 1]] [[Costs money]]",
        "",
        "[[Investigate]] [[Observed]] read [SPEC.md](file:///repo/SPEC.md); [[Unverified]] runtime.",
        "",
        "- BLOCKER — [[Broken]] **Lost structure**",
        "  - `simplify.go` detail",
        "  - **Do:** fix extraction",
        "",
        "setup → build → test ✓",
        "",
        "▰▰▰▰▱ 4 of 5 checks",
        "",
        "├── client/",
        "└── shared/",
        "",
        "| Module | State |",
        "| --- | :---: |",
        "| [parse.ts](file:///repo/parse.ts) | [[Passed 12/12]] |",
        "",
        "**Next:** verify in Paseo",
      ].join("\n");

      const data = parseEmphasis(source, "complete");
      expect(data).not.toBeNull();
      if (data === null) return;

      const tree = expandElement(
        EmphasisMessage({
          agentId: "agent-1",
          theme: DARK_THEME,
          host: { id: "host-1", label: "Local" },
          layout: { compact, platform: "web" },
          timestamp: new Date("2026-11-18T00:00:00Z"),
          item: { type: "plugin", kind: "emphasis", version: 1, data },
        }),
      );

      const colors: Array<string | undefined> = [];
      flattenTextColors(tree, colors);
      expect(colors.length).toBeGreaterThan(0);
      expect(colors.every((color) => typeof color === "string" && color.length > 0)).toBe(true);
      expect(collectMarkdownCount(tree)).toBeGreaterThanOrEqual(5);
    },
  );
});
