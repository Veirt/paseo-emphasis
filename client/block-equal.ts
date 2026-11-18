import type {
  EmphasisBlock,
  EmphasisTable,
  GaugeData,
  ListItem,
  PillData,
  StepData,
  TableCell,
  TagData,
} from "../shared/emphasis";

function sameArray<T>(
  a: readonly T[],
  b: readonly T[],
  equal: (left: T, right: T) => boolean,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined || right === undefined || !equal(left, right)) return false;
  }
  return true;
}

function sameString(a: string, b: string): boolean {
  return a === b;
}

function samePill(a: PillData, b: PillData): boolean {
  return a.label === b.label && a.tone === b.tone && a.icon === b.icon;
}

function sameTag(a: TagData | undefined, b: TagData | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return a.label === b.label && a.tone === b.tone;
}

function sameGauge(a: GaugeData, b: GaugeData): boolean {
  return a.filled === b.filled && a.total === b.total;
}

export function sameSteps(a: readonly StepData[], b: readonly StepData[]): boolean {
  return sameArray(
    a,
    b,
    (left, right) =>
      left.label === right.label &&
      left.tone === right.tone &&
      left.icon === right.icon &&
      left.pass === right.pass,
  );
}

function sameListItem(a: ListItem, b: ListItem): boolean {
  return (
    a.markerLabel === b.markerLabel &&
    a.leadMark === b.leadMark &&
    a.body === b.body &&
    sameTag(a.tag, b.tag) &&
    sameArray(a.chips, b.chips, samePill)
  );
}

function sameCell(a: TableCell, b: TableCell): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "markdown":
      return b.kind === "markdown" && a.text === b.text;
    case "chips":
      return b.kind === "chips" && a.text === b.text && sameArray(a.chips, b.chips, samePill);
    case "stepper":
      return b.kind === "stepper" && sameSteps(a.steps, b.steps);
    case "gauge":
      return b.kind === "gauge" && a.text === b.text && sameGauge(a.gauge, b.gauge);
    case "mark":
      return b.kind === "mark" && a.pass === b.pass && a.text === b.text;
  }
}

export function sameTable(a: EmphasisTable, b: EmphasisTable): boolean {
  if (a === b) return true;
  return (
    sameArray(a.aligns, b.aligns, sameString) &&
    sameArray(a.header, b.header, sameCell) &&
    sameArray(a.rows, b.rows, (leftRow, rightRow) => sameArray(leftRow, rightRow, sameCell))
  );
}

export function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return sameArray(a, b, sameString);
}

export function sameHeading(
  a: Extract<EmphasisBlock, { type: "heading" }>,
  b: Extract<EmphasisBlock, { type: "heading" }>,
): boolean {
  return a.level === b.level && a.icon === b.icon && a.title === b.title;
}

export function sameChips(
  a: Extract<EmphasisBlock, { type: "chips" }>,
  b: Extract<EmphasisBlock, { type: "chips" }>,
): boolean {
  return (
    a.inline === b.inline &&
    a.body === b.body &&
    sameTag(a.tag, b.tag) &&
    sameArray(a.chips, b.chips, samePill)
  );
}

export function sameList(
  a: Extract<EmphasisBlock, { type: "list" }>,
  b: Extract<EmphasisBlock, { type: "list" }>,
): boolean {
  return (
    a.ordered === b.ordered &&
    a.start === b.start &&
    a.omitMarkers === b.omitMarkers &&
    sameArray(a.items, b.items, sameListItem)
  );
}

export function sameGaugeBlock(
  a: Extract<EmphasisBlock, { type: "gauge" }>,
  b: Extract<EmphasisBlock, { type: "gauge" }>,
): boolean {
  return a.body === b.body && sameGauge(a.gauge, b.gauge);
}
