# Evaluation Review Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-deployable static React site that lets a reviewer upload one evaluation zip, inspect model extraction quality per dialogue, save dialogue-level annotations, and export changed annotations as JSONL.

**Architecture:** Use a Vite React static frontend with domain logic split into pure TypeScript modules. JSZip reads the uploaded artifact in the browser; parsing, normalization, filtering, annotation persistence, and export are unit-tested separately from UI components. React owns screen state and rendering only.

**Tech Stack:** Bun, Vite, React, TypeScript, JSZip, Vitest, Testing Library, lucide-react, CSS modules or plain CSS in `src/styles.css`.

---

## File Structure

- Create `package.json`: Bun scripts and dependencies.
- Create `index.html`: Vite entry shell.
- Create `tsconfig.json`: strict TypeScript settings for app code.
- Create `tsconfig.node.json`: TypeScript settings for Vite config.
- Create `vite.config.ts`: React and Vitest configuration.
- Create `src/main.tsx`: React mount point.
- Create `src/App.tsx`: top-level app state, upload flow, active dialogue selection.
- Create `src/styles.css`: full workbench styling.
- Create `src/test/setup.ts`: Testing Library matcher setup.
- Create `src/domain/types.ts`: shared data types and status constants.
- Create `src/domain/jsonl.ts`: line-numbered JSONL parsing and serialization helpers.
- Create `src/domain/jsonl.test.ts`: JSONL parser tests.
- Create `src/domain/fileDiscovery.ts`: zip entry classification.
- Create `src/domain/fileDiscovery.test.ts`: file discovery tests.
- Create `src/domain/normalize.ts`: combine summary, row audit, predictions, event details, and failures into app state.
- Create `src/domain/normalize.test.ts`: normalization tests.
- Create `src/domain/annotations.ts`: localStorage keying, status handling, export filtering, JSONL export records.
- Create `src/domain/annotations.test.ts`: annotation persistence and export tests.
- Create `src/domain/filters.ts`: dialogue search and filter predicates.
- Create `src/domain/filters.test.ts`: filter tests.
- Create `src/domain/format.ts`: percentage, number, and optional metric formatting.
- Create `src/domain/format.test.ts`: formatting tests.
- Create `src/components/UploadPanel.tsx`: upload input, loading state, and parse errors.
- Create `src/components/SummaryBar.tsx`: artifact-level metrics and annotation progress.
- Create `src/components/DialogueList.tsx`: search, filters, and dialogue list.
- Create `src/components/DialogueDetail.tsx`: dialogue text, event comparisons, failures, and navigation.
- Create `src/components/AnnotationPanel.tsx`: status selector, note editor, save/clear/export actions.
- Create `src/components/Workbench.tsx`: layout composition for summary, list, detail, and annotations.
- Create `src/test/fixtures.ts`: small reusable sample objects for tests.
- Create `README.md`: local development, build, Vercel deployment, and privacy notes.

---

### Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create package manifest**

Create `package.json` with Bun-friendly scripts:

```json
{
  "name": "benchmark-audit",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "*",
    "jszip": "*",
    "lucide-react": "*",
    "react": "*",
    "react-dom": "*",
    "vite": "*"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "*",
    "@testing-library/react": "*",
    "@testing-library/user-event": "*",
    "@types/react": "*",
    "@types/react-dom": "*",
    "jsdom": "*",
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `bun install`

Expected: Bun creates `bun.lock`, installs React, Vite, JSZip, Vitest, and Testing Library without errors.

- [ ] **Step 3: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"]
  }
});
```

- [ ] **Step 4: Create test setup and minimal React entry**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Evaluation Review</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <h1>Evaluation Review</h1>
      <p>Upload an evaluation zip to begin.</p>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #18202f;
  background: #f5f7fb;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}
```

- [ ] **Step 5: Verify scaffold**

Run: `bun test`

Expected: Vitest starts and reports no test files or zero tests without TypeScript errors.

Run: `bun run build`

Expected: TypeScript and Vite build complete and create `dist/`.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json bun.lock index.html tsconfig.json tsconfig.node.json vite.config.ts src/test/setup.ts src/main.tsx src/App.tsx src/styles.css
git commit -m "chore: scaffold evaluation review app"
```

---

### Task 2: JSONL Parsing And File Discovery

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/jsonl.ts`
- Create: `src/domain/jsonl.test.ts`
- Create: `src/domain/fileDiscovery.ts`
- Create: `src/domain/fileDiscovery.test.ts`

- [ ] **Step 1: Write failing JSONL parser tests**

Create `src/domain/jsonl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseJsonl, stringifyJsonl } from "./jsonl";

describe("parseJsonl", () => {
  it("parses non-empty JSONL lines and skips blank lines", () => {
    const rows = parseJsonl<{ id: string }>('{"id":"a"}\n\n{"id":"b"}\n', "rows.jsonl");
    expect(rows).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("reports file name and one-based line number on invalid JSON", () => {
    expect(() => parseJsonl('{"id":"a"}\nnot-json\n', "rows.jsonl")).toThrow(
      "rows.jsonl line 2"
    );
  });
});

describe("stringifyJsonl", () => {
  it("serializes each record on its own line and ends with a newline", () => {
    expect(stringifyJsonl([{ id: "a" }, { id: "b" }])).toBe('{"id":"a"}\n{"id":"b"}\n');
  });
});
```

- [ ] **Step 2: Run JSONL tests to verify they fail**

Run: `bun test src/domain/jsonl.test.ts`

Expected: FAIL because `src/domain/jsonl.ts` does not exist.

- [ ] **Step 3: Create shared types and JSONL helpers**

Create `src/domain/types.ts` with these exported types:

```ts
export type ReviewStatus = "unreviewed" | "accepted" | "has_issue" | "skip";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "unreviewed",
  "accepted",
  "has_issue",
  "skip"
];

export type FieldName = "actor" | "time" | "location" | "action";

export interface ExtractedEvent {
  actor?: string[] | null;
  time?: string[] | null;
  location?: string[] | null;
  action?: string[] | null;
  digest?: string;
  source_order?: number;
}

export interface PredictionRow {
  dialogue_id: string;
  dialogue: string[];
  events: ExtractedEvent[];
}

export interface FieldComparison {
  gold: string[];
  pred: string[];
  TP: number;
  FP: number;
  FN: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface EventComparison {
  weighted_f1: number;
  active_weight: number;
  fields: Record<FieldName, FieldComparison>;
  artifact: string;
  dialogue_id: string;
  row_index: number;
  match_status: "matched" | "unmatched_gold" | "unmatched_prediction" | string;
  gold_event_index: number | null;
  pred_event_index: number | null;
  alignment_score: number;
  gold_event: ExtractedEvent | null;
  pred_event: ExtractedEvent | null;
}

export interface RowAudit {
  row_index: number;
  dialogue_id: string;
  gold_event_count: number;
  pred_event_count: number;
  matched_events: number;
  unmatched_gold: number;
  unmatched_pred: number;
  events: EventComparison[];
}

export interface FieldMetrics {
  TP: number;
  FP: number;
  FN: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvaluationSummary {
  artifact: string;
  overall_weighted_f1: number;
  field_f1: Record<FieldName, number>;
  field_metrics: Record<FieldName, FieldMetrics>;
  gold_events: number;
  prediction_events: number;
  events_evaluated: number;
  events_matched: number;
  unmatched_gold: number;
  unmatched_prediction: number;
  rows_checked: number;
  rows_with_unmatched_gold: number;
  rows_fully_matched: number;
  rows_with_zero_prediction_events_despite_gold_events: number;
  events_written: number;
  extraction_normalization_failures: number;
  weights: Record<FieldName, number>;
  alignment: {
    method: string;
    threshold: number;
  };
}

export interface FailureRecord {
  dialogue_id: string;
  line_number: number;
  event_index: number | null;
  reason: string;
}

export interface Annotation {
  artifact: string;
  dialogue_id: string;
  row_index: number;
  review_status: ReviewStatus;
  review_note: string;
  updated_at: string;
}

export interface DialogueReview {
  row_index: number;
  dialogue_id: string;
  dialogue: string[];
  goldEvents: ExtractedEvent[];
  predEvents: ExtractedEvent[];
  rowAudit: RowAudit | null;
  failure: FailureRecord | null;
}

export interface ReviewDataset {
  artifact: string;
  summary: EvaluationSummary;
  dialogues: DialogueReview[];
  warnings: string[];
}
```

Create `src/domain/jsonl.ts`:

```ts
export function parseJsonl<T>(text: string, sourceName: string): T[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, lineNumber }) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(
          `${sourceName} line ${lineNumber}: ${(error as Error).message}`
        );
      }
    });
}

export function stringifyJsonl(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}
```

- [ ] **Step 4: Run JSONL tests to verify they pass**

Run: `bun test src/domain/jsonl.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing file discovery tests**

Create `src/domain/fileDiscovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyZipEntries } from "./fileDiscovery";

describe("classifyZipEntries", () => {
  it("finds logical evaluation files under an artifact directory", () => {
    const entries = classifyZipEntries([
      "google_gemma_4_31B_it/event_eval_summary.json",
      "google_gemma_4_31B_it/row_audit_report.jsonl",
      "google_gemma_4_31B_it/event_eval_details.jsonl",
      "google_gemma_4_31B_it/google_gemma-4-31B-it.jsonl",
      "google_gemma_4_31B_it/google_gemma-4-31B-it.failures.jsonl",
      "__MACOSX/google_gemma_4_31B_it/._row_audit_report.jsonl"
    ]);

    expect(entries.summary).toBe("google_gemma_4_31B_it/event_eval_summary.json");
    expect(entries.rowAudit).toBe("google_gemma_4_31B_it/row_audit_report.jsonl");
    expect(entries.eventDetails).toBe("google_gemma_4_31B_it/event_eval_details.jsonl");
    expect(entries.predictions).toBe("google_gemma_4_31B_it/google_gemma-4-31B-it.jsonl");
    expect(entries.failures).toBe(
      "google_gemma_4_31B_it/google_gemma-4-31B-it.failures.jsonl"
    );
  });

  it("reports missing required logical files", () => {
    const entries = classifyZipEntries(["artifact/event_eval_summary.json"]);
    expect(entries.missingRequired).toEqual([
      "row_audit_report.jsonl",
      "event_eval_details.jsonl",
      "prediction jsonl"
    ]);
  });
});
```

- [ ] **Step 6: Run file discovery tests to verify they fail**

Run: `bun test src/domain/fileDiscovery.test.ts`

Expected: FAIL because `src/domain/fileDiscovery.ts` does not exist.

- [ ] **Step 7: Create file discovery module**

Create `src/domain/fileDiscovery.ts`:

```ts
export interface ClassifiedEntries {
  summary: string | null;
  rowAudit: string | null;
  eventDetails: string | null;
  predictions: string | null;
  failures: string | null;
  missingRequired: string[];
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function isMacOsMetadata(path: string): boolean {
  return path.includes("__MACOSX/") || basename(path).startsWith("._");
}

export function classifyZipEntries(paths: string[]): ClassifiedEntries {
  const usablePaths = paths.filter((path) => !isMacOsMetadata(path));
  const summary = usablePaths.find((path) => basename(path) === "event_eval_summary.json") ?? null;
  const rowAudit = usablePaths.find((path) => basename(path) === "row_audit_report.jsonl") ?? null;
  const eventDetails =
    usablePaths.find((path) => basename(path) === "event_eval_details.jsonl") ?? null;
  const failures =
    usablePaths.find((path) => basename(path).endsWith(".failures.jsonl")) ?? null;
  const predictions =
    usablePaths.find((path) => {
      const name = basename(path);
      return (
        name.endsWith(".jsonl") &&
        name !== "row_audit_report.jsonl" &&
        name !== "event_eval_details.jsonl" &&
        !name.endsWith(".failures.jsonl")
      );
    }) ?? null;

  const missingRequired: string[] = [];
  if (!summary) missingRequired.push("event_eval_summary.json");
  if (!rowAudit) missingRequired.push("row_audit_report.jsonl");
  if (!eventDetails) missingRequired.push("event_eval_details.jsonl");
  if (!predictions) missingRequired.push("prediction jsonl");

  return { summary, rowAudit, eventDetails, predictions, failures, missingRequired };
}
```

- [ ] **Step 8: Run discovery tests to verify they pass**

Run: `bun test src/domain/fileDiscovery.test.ts src/domain/jsonl.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit parsing foundation**

Run:

```bash
git add src/domain/types.ts src/domain/jsonl.ts src/domain/jsonl.test.ts src/domain/fileDiscovery.ts src/domain/fileDiscovery.test.ts
git commit -m "feat: add evaluation file parsing foundation"
```

---

### Task 3: Dataset Normalization

**Files:**
- Create: `src/domain/normalize.ts`
- Create: `src/domain/normalize.test.ts`
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Create reusable test fixtures**

Create `src/test/fixtures.ts` with a compact dataset:

```ts
import type {
  EvaluationSummary,
  FailureRecord,
  PredictionRow,
  RowAudit
} from "../domain/types";

export const summaryFixture: EvaluationSummary = {
  artifact: "google_gemma_4_31B_it",
  overall_weighted_f1: 0.3652328807822301,
  field_f1: {
    actor: 0.7251655629139073,
    time: 0.5297418630751964,
    location: 0.5748031496062992,
    action: 0.21030042918454936
  },
  field_metrics: {
    actor: { TP: 438, FP: 75, FN: 257, precision: 0.8538, recall: 0.6302, f1: 0.7252 },
    time: { TP: 236, FP: 106, FN: 313, precision: 0.6901, recall: 0.4299, f1: 0.5297 },
    location: { TP: 73, FP: 45, FN: 63, precision: 0.6186, recall: 0.5368, f1: 0.5748 },
    action: { TP: 98, FP: 232, FN: 504, precision: 0.297, recall: 0.1628, f1: 0.2103 }
  },
  gold_events: 522,
  prediction_events: 330,
  events_evaluated: 537,
  events_matched: 315,
  unmatched_gold: 207,
  unmatched_prediction: 15,
  rows_checked: 200,
  rows_with_unmatched_gold: 140,
  rows_fully_matched: 56,
  rows_with_zero_prediction_events_despite_gold_events: 7,
  events_written: 200,
  extraction_normalization_failures: 0,
  weights: { action: 0.35, actor: 0.3, time: 0.25, location: 0.1 },
  alignment: {
    method: "same dialogue greedy one-to-one soft similarity then exact field scoring",
    threshold: 0.28
  }
};

export const predictionRowsFixture: PredictionRow[] = [
  {
    dialogue_id: "56",
    dialogue: ["speaker_1:我 8 点 起床", "speaker_2:sad"],
    events: []
  }
];

export const rowAuditsFixture: RowAudit[] = [
  {
    row_index: 0,
    dialogue_id: "56",
    gold_event_count: 1,
    pred_event_count: 0,
    matched_events: 0,
    unmatched_gold: 1,
    unmatched_pred: 0,
    events: [
      {
        weighted_f1: 0,
        active_weight: 0.9,
        fields: {
          actor: { gold: ["speaker_1"], pred: [], TP: 0, FP: 0, FN: 1, precision: null, recall: 0, f1: 0 },
          time: { gold: ["8点"], pred: [], TP: 0, FP: 0, FN: 1, precision: null, recall: 0, f1: 0 },
          location: { gold: [], pred: [], TP: 0, FP: 0, FN: 0, precision: null, recall: null, f1: null },
          action: { gold: ["起床"], pred: [], TP: 0, FP: 0, FN: 1, precision: null, recall: 0, f1: 0 }
        },
        artifact: "google_gemma_4_31B_it",
        dialogue_id: "56",
        row_index: 0,
        match_status: "unmatched_gold",
        gold_event_index: 0,
        pred_event_index: null,
        alignment_score: 0,
        gold_event: {
          actor: ["speaker_1"],
          time: ["8点"],
          location: null,
          action: ["起床"],
          digest: "speaker_18点起床"
        },
        pred_event: null
      }
    ]
  }
];

export const failuresFixture: FailureRecord[] = [
  {
    dialogue_id: "56",
    line_number: 1,
    event_index: null,
    reason: "remote provider HTTP 504"
  }
];
```

- [ ] **Step 2: Write failing normalization tests**

Create `src/domain/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { normalizeDataset } from "./normalize";

describe("normalizeDataset", () => {
  it("joins prediction rows, row audits, and failures by dialogue id", () => {
    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: rowAuditsFixture[0].events,
      predictionRows: predictionRowsFixture,
      failures: failuresFixture
    });

    expect(dataset.artifact).toBe("google_gemma_4_31B_it");
    expect(dataset.dialogues).toHaveLength(1);
    expect(dataset.dialogues[0]).toMatchObject({
      dialogue_id: "56",
      row_index: 0,
      dialogue: ["speaker_1:我 8 点 起床", "speaker_2:sad"],
      rowAudit: { gold_event_count: 1, pred_event_count: 0 },
      failure: { reason: "remote provider HTTP 504" }
    });
    expect(dataset.dialogues[0].goldEvents).toHaveLength(1);
    expect(dataset.dialogues[0].predEvents).toHaveLength(0);
  });

  it("adds a warning when row audit and prediction records do not align", () => {
    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: [],
      predictionRows: [],
      failures: []
    });

    expect(dataset.warnings).toContain("1 row audit record has no matching prediction row.");
    expect(dataset.dialogues[0].dialogue_id).toBe("56");
  });
});
```

- [ ] **Step 3: Run normalization tests to verify they fail**

Run: `bun test src/domain/normalize.test.ts`

Expected: FAIL because `src/domain/normalize.ts` does not exist.

- [ ] **Step 4: Create normalization module**

Create `src/domain/normalize.ts`:

```ts
import type {
  EvaluationSummary,
  EventComparison,
  FailureRecord,
  PredictionRow,
  ReviewDataset,
  RowAudit
} from "./types";

export interface NormalizeInput {
  summary: EvaluationSummary;
  rowAudits: RowAudit[];
  eventDetails: EventComparison[];
  predictionRows: PredictionRow[];
  failures: FailureRecord[];
}

function firstByDialogueId<T extends { dialogue_id: string }>(records: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    if (!map.has(record.dialogue_id)) {
      map.set(record.dialogue_id, record);
    }
  }
  return map;
}

function warningForMissing(count: number, singular: string, plural: string): string | null {
  if (count === 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function normalizeDataset(input: NormalizeInput): ReviewDataset {
  const predictionsByDialogue = firstByDialogueId(input.predictionRows);
  const failuresByDialogue = firstByDialogueId(input.failures);
  const warnings: string[] = [];

  let auditsWithoutPredictions = 0;

  const dialogues = input.rowAudits.map((rowAudit) => {
    const prediction = predictionsByDialogue.get(rowAudit.dialogue_id) ?? null;
    if (!prediction) auditsWithoutPredictions += 1;

    return {
      row_index: rowAudit.row_index,
      dialogue_id: rowAudit.dialogue_id,
      dialogue: prediction?.dialogue ?? [],
      goldEvents: rowAudit.events.flatMap((event) => event.gold_event ? [event.gold_event] : []),
      predEvents: prediction?.events ?? rowAudit.events.flatMap((event) => event.pred_event ? [event.pred_event] : []),
      rowAudit,
      failure: failuresByDialogue.get(rowAudit.dialogue_id) ?? null
    };
  });

  const missingPredictionWarning = warningForMissing(
    auditsWithoutPredictions,
    "row audit record has no matching prediction row.",
    "row audit records have no matching prediction rows."
  );
  if (missingPredictionWarning) warnings.push(missingPredictionWarning);

  const auditIds = new Set(input.rowAudits.map((row) => row.dialogue_id));
  const predictionsWithoutAudits = input.predictionRows.filter(
    (row) => !auditIds.has(row.dialogue_id)
  ).length;
  const missingAuditWarning = warningForMissing(
    predictionsWithoutAudits,
    "prediction row has no matching row audit record.",
    "prediction rows have no matching row audit records."
  );
  if (missingAuditWarning) warnings.push(missingAuditWarning);

  return {
    artifact: input.summary.artifact,
    summary: input.summary,
    dialogues,
    warnings
  };
}
```

- [ ] **Step 5: Run normalization tests to verify they pass**

Run: `bun test src/domain/normalize.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit normalization**

Run:

```bash
git add src/domain/normalize.ts src/domain/normalize.test.ts src/test/fixtures.ts
git commit -m "feat: normalize evaluation dataset"
```

---

### Task 4: Annotations, Filtering, And Formatting

**Files:**
- Create: `src/domain/annotations.ts`
- Create: `src/domain/annotations.test.ts`
- Create: `src/domain/filters.ts`
- Create: `src/domain/filters.test.ts`
- Create: `src/domain/format.ts`
- Create: `src/domain/format.test.ts`

- [ ] **Step 1: Write failing annotation tests**

Create `src/domain/annotations.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { rowAuditsFixture } from "../test/fixtures";
import {
  annotationStorageKey,
  exportAnnotations,
  getExportableAnnotations,
  loadAnnotations,
  saveAnnotations
} from "./annotations";
import type { Annotation } from "./types";

const annotation: Annotation = {
  artifact: "google_gemma_4_31B_it",
  dialogue_id: "56",
  row_index: 0,
  review_status: "has_issue",
  review_note: "模型没有抽出事件",
  updated_at: "2026-04-29T00:00:00.000Z"
};

describe("annotations", () => {
  beforeEach(() => localStorage.clear());

  it("scopes localStorage keys by artifact", () => {
    expect(annotationStorageKey("google_gemma_4_31B_it")).toBe(
      "evaluation-review:google_gemma_4_31B_it:annotations"
    );
  });

  it("saves and loads annotations", () => {
    saveAnnotations("google_gemma_4_31B_it", { "56": annotation });
    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({ "56": annotation });
  });

  it("exports only changed annotations", () => {
    const untouched: Annotation = {
      ...annotation,
      dialogue_id: "57",
      review_status: "unreviewed",
      review_note: ""
    };

    expect(getExportableAnnotations({ "56": annotation, "57": untouched })).toEqual([
      annotation
    ]);
  });

  it("adds row context and exported_at to JSONL export", () => {
    const jsonl = exportAnnotations({
      annotations: { "56": annotation },
      rowsByDialogueId: new Map([["56", rowAuditsFixture[0]]]),
      exportedAt: "2026-04-29T00:00:00.000Z"
    });

    expect(jsonl).toBe(
      '{"artifact":"google_gemma_4_31B_it","dialogue_id":"56","row_index":0,"review_status":"has_issue","review_note":"模型没有抽出事件","gold_event_count":1,"pred_event_count":0,"matched_events":0,"unmatched_gold":1,"unmatched_pred":0,"exported_at":"2026-04-29T00:00:00.000Z"}\n'
    );
  });
});
```

- [ ] **Step 2: Run annotation tests to verify they fail**

Run: `bun test src/domain/annotations.test.ts`

Expected: FAIL because `src/domain/annotations.ts` does not exist.

- [ ] **Step 3: Create annotation module**

Create `src/domain/annotations.ts`:

```ts
import { stringifyJsonl } from "./jsonl";
import type { Annotation, RowAudit } from "./types";

export type AnnotationMap = Record<string, Annotation>;

export function annotationStorageKey(artifact: string): string {
  return `evaluation-review:${artifact}:annotations`;
}

export function loadAnnotations(artifact: string): AnnotationMap {
  const raw = localStorage.getItem(annotationStorageKey(artifact));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AnnotationMap;
  } catch {
    return {};
  }
}

export function saveAnnotations(artifact: string, annotations: AnnotationMap): void {
  localStorage.setItem(annotationStorageKey(artifact), JSON.stringify(annotations));
}

export function clearAnnotations(artifact: string): void {
  localStorage.removeItem(annotationStorageKey(artifact));
}

export function getExportableAnnotations(annotations: AnnotationMap): Annotation[] {
  return Object.values(annotations).filter(
    (annotation) =>
      annotation.review_status !== "unreviewed" || annotation.review_note.trim().length > 0
  );
}

export interface ExportAnnotationsInput {
  annotations: AnnotationMap;
  rowsByDialogueId: Map<string, RowAudit>;
  exportedAt: string;
}

export function exportAnnotations(input: ExportAnnotationsInput): string {
  const records = getExportableAnnotations(input.annotations).map((annotation) => {
    const row = input.rowsByDialogueId.get(annotation.dialogue_id);
    return {
      artifact: annotation.artifact,
      dialogue_id: annotation.dialogue_id,
      row_index: annotation.row_index,
      review_status: annotation.review_status,
      review_note: annotation.review_note,
      gold_event_count: row?.gold_event_count ?? null,
      pred_event_count: row?.pred_event_count ?? null,
      matched_events: row?.matched_events ?? null,
      unmatched_gold: row?.unmatched_gold ?? null,
      unmatched_pred: row?.unmatched_pred ?? null,
      exported_at: input.exportedAt
    };
  });

  return stringifyJsonl(records);
}
```

- [ ] **Step 4: Run annotation tests to verify they pass**

Run: `bun test src/domain/annotations.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing filter and format tests**

Create `src/domain/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rowAuditsFixture } from "../test/fixtures";
import { filterDialogues } from "./filters";
import type { DialogueReview } from "./types";

const dialogue: DialogueReview = {
  row_index: 0,
  dialogue_id: "56",
  dialogue: ["speaker_1:我 8 点 起床"],
  goldEvents: [],
  predEvents: [],
  rowAudit: rowAuditsFixture[0],
  failure: null
};

describe("filterDialogues", () => {
  it("filters by dialogue id search text", () => {
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {},
        search: "56",
        reviewStatus: "all",
        evaluationStatus: "all"
      })
    ).toHaveLength(1);
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {},
        search: "99",
        reviewStatus: "all",
        evaluationStatus: "all"
      })
    ).toHaveLength(0);
  });

  it("filters by review status and evaluation status", () => {
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: { "56": { artifact: "a", dialogue_id: "56", row_index: 0, review_status: "accepted", review_note: "", updated_at: "now" } },
        search: "",
        reviewStatus: "accepted",
        evaluationStatus: "unmatched_gold"
      })
    ).toHaveLength(1);
  });
});
```

Create `src/domain/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatMetric, formatOptionalMetric } from "./format";

describe("metric formatting", () => {
  it("formats numbers as percentages with one decimal place", () => {
    expect(formatMetric(0.3652)).toBe("36.5%");
  });

  it("uses a dash for null optional metrics", () => {
    expect(formatOptionalMetric(null)).toBe("-");
  });
});
```

- [ ] **Step 6: Run filter and format tests to verify they fail**

Run: `bun test src/domain/filters.test.ts src/domain/format.test.ts`

Expected: FAIL because `filters.ts` and `format.ts` do not exist.

- [ ] **Step 7: Create filter and format modules**

Create `src/domain/filters.ts`:

```ts
import type { AnnotationMap } from "./annotations";
import type { DialogueReview, ReviewStatus } from "./types";

export type ReviewStatusFilter = ReviewStatus | "all";
export type EvaluationStatusFilter =
  | "all"
  | "fully_matched"
  | "unmatched_gold"
  | "unmatched_prediction"
  | "zero_prediction"
  | "failure";

export interface FilterInput {
  dialogues: DialogueReview[];
  annotations: AnnotationMap;
  search: string;
  reviewStatus: ReviewStatusFilter;
  evaluationStatus: EvaluationStatusFilter;
}

function reviewStatusFor(dialogue: DialogueReview, annotations: AnnotationMap): ReviewStatus {
  return annotations[dialogue.dialogue_id]?.review_status ?? "unreviewed";
}

function matchesEvaluationStatus(
  dialogue: DialogueReview,
  evaluationStatus: EvaluationStatusFilter
): boolean {
  if (evaluationStatus === "all") return true;
  if (evaluationStatus === "failure") return Boolean(dialogue.failure);
  const audit = dialogue.rowAudit;
  if (!audit) return false;
  if (evaluationStatus === "fully_matched") return audit.unmatched_gold === 0 && audit.unmatched_pred === 0;
  if (evaluationStatus === "unmatched_gold") return audit.unmatched_gold > 0;
  if (evaluationStatus === "unmatched_prediction") return audit.unmatched_pred > 0;
  if (evaluationStatus === "zero_prediction") return audit.gold_event_count > 0 && audit.pred_event_count === 0;
  return true;
}

export function filterDialogues(input: FilterInput): DialogueReview[] {
  const search = input.search.trim();
  return input.dialogues.filter((dialogue) => {
    const matchesSearch = search.length === 0 || dialogue.dialogue_id.includes(search);
    const matchesReview =
      input.reviewStatus === "all" ||
      reviewStatusFor(dialogue, input.annotations) === input.reviewStatus;
    const matchesEvaluation = matchesEvaluationStatus(dialogue, input.evaluationStatus);
    return matchesSearch && matchesReview && matchesEvaluation;
  });
}
```

Create `src/domain/format.ts`:

```ts
export function formatMetric(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatOptionalMetric(value: number | null): string {
  return value === null ? "-" : formatMetric(value);
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toLocaleString("en-US");
}
```

- [ ] **Step 8: Run all domain tests**

Run: `bun test src/domain`

Expected: PASS.

- [ ] **Step 9: Commit domain state helpers**

Run:

```bash
git add src/domain/annotations.ts src/domain/annotations.test.ts src/domain/filters.ts src/domain/filters.test.ts src/domain/format.ts src/domain/format.test.ts
git commit -m "feat: add annotation and filtering helpers"
```

---

### Task 5: Zip Loading Service

**Files:**
- Create: `src/domain/loadEvaluationZip.ts`
- Create: `src/domain/loadEvaluationZip.test.ts`

- [ ] **Step 1: Write failing zip loading tests**

Create `src/domain/loadEvaluationZip.test.ts`:

```ts
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { loadEvaluationZip } from "./loadEvaluationZip";

async function makeZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "artifact.zip", { type: "application/zip" });
}

describe("loadEvaluationZip", () => {
  it("loads a complete evaluation artifact", async () => {
    const file = await makeZip({
      "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
      "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
      "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
      "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`,
      "artifact/model.failures.jsonl": `${JSON.stringify(failuresFixture[0])}\n`
    });

    const dataset = await loadEvaluationZip(file);
    expect(dataset.artifact).toBe("google_gemma_4_31B_it");
    expect(dataset.dialogues).toHaveLength(1);
    expect(dataset.dialogues[0].failure?.reason).toBe("remote provider HTTP 504");
  });

  it("throws a readable error when required files are missing", async () => {
    const file = await makeZip({
      "artifact/event_eval_summary.json": JSON.stringify(summaryFixture)
    });

    await expect(loadEvaluationZip(file)).rejects.toThrow(
      "Missing required files: row_audit_report.jsonl, event_eval_details.jsonl, prediction jsonl"
    );
  });

  it("loads a complete artifact when the optional failures file is absent", async () => {
    const file = await makeZip({
      "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
      "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
      "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
      "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`
    });

    const dataset = await loadEvaluationZip(file);
    expect(dataset.dialogues[0].failure).toBeNull();
  });
});
```

- [ ] **Step 2: Run zip loading tests to verify they fail**

Run: `bun test src/domain/loadEvaluationZip.test.ts`

Expected: FAIL because `src/domain/loadEvaluationZip.ts` does not exist.

- [ ] **Step 3: Create zip loading service**

Create `src/domain/loadEvaluationZip.ts`:

```ts
import JSZip from "jszip";
import { classifyZipEntries } from "./fileDiscovery";
import { parseJsonl } from "./jsonl";
import { normalizeDataset } from "./normalize";
import type {
  EvaluationSummary,
  EventComparison,
  FailureRecord,
  PredictionRow,
  ReviewDataset,
  RowAudit
} from "./types";

async function readText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`Zip entry not found: ${path}`);
  return entry.async("text");
}

export async function loadEvaluationZip(file: File): Promise<ReviewDataset> {
  const zip = await JSZip.loadAsync(file);
  const entries = classifyZipEntries(Object.keys(zip.files));

  if (entries.missingRequired.length > 0) {
    throw new Error(`Missing required files: ${entries.missingRequired.join(", ")}`);
  }

  const summaryText = await readText(zip, entries.summary as string);
  const rowAuditText = await readText(zip, entries.rowAudit as string);
  const eventDetailsText = await readText(zip, entries.eventDetails as string);
  const predictionText = await readText(zip, entries.predictions as string);

  const failuresText = entries.failures ? await readText(zip, entries.failures) : "";

  const summary = JSON.parse(summaryText) as EvaluationSummary;
  const rowAudits = parseJsonl<RowAudit>(rowAuditText, entries.rowAudit as string);
  const eventDetails = parseJsonl<EventComparison>(
    eventDetailsText,
    entries.eventDetails as string
  );
  const predictionRows = parseJsonl<PredictionRow>(
    predictionText,
    entries.predictions as string
  );
  const failures = failuresText
    ? parseJsonl<FailureRecord>(failuresText, entries.failures as string)
    : [];

  return normalizeDataset({ summary, rowAudits, eventDetails, predictionRows, failures });
}
```

- [ ] **Step 4: Run zip loading tests to verify they pass**

Run: `bun test src/domain/loadEvaluationZip.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full test suite and commit**

Run: `bun test`

Expected: PASS.

Run:

```bash
git add src/domain/loadEvaluationZip.ts src/domain/loadEvaluationZip.test.ts
git commit -m "feat: load evaluation zip artifacts"
```

---

### Task 6: React Upload Flow And Workbench State

**Files:**
- Create: `src/components/UploadPanel.tsx`
- Create: `src/components/Workbench.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing app interaction test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import App from "./App";
import { predictionRowsFixture, rowAuditsFixture, summaryFixture } from "./test/fixtures";

async function makeEvaluationZip(): Promise<File> {
  const zip = new JSZip();
  zip.file("artifact/event_eval_summary.json", JSON.stringify(summaryFixture));
  zip.file("artifact/row_audit_report.jsonl", `${JSON.stringify(rowAuditsFixture[0])}\n`);
  zip.file("artifact/event_eval_details.jsonl", `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`);
  zip.file("artifact/model.jsonl", `${JSON.stringify(predictionRowsFixture[0])}\n`);
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "artifact.zip", { type: "application/zip" });
}

describe("App", () => {
  it("loads an evaluation zip and shows the workbench", async () => {
    render(<App />);

    await userEvent.upload(
      screen.getByLabelText("Upload evaluation zip"),
      await makeEvaluationZip()
    );

    expect(await screen.findByText("google_gemma_4_31B_it")).toBeInTheDocument();
    expect(screen.getByText("Dialogue 56")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run app test to verify it fails**

Run: `bun test src/App.test.tsx`

Expected: FAIL because upload UI and workbench components do not exist.

- [ ] **Step 3: Create upload panel**

Create `src/components/UploadPanel.tsx`:

```tsx
import { Upload } from "lucide-react";

interface UploadPanelProps {
  loading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}

export function UploadPanel({ loading, error, onFileSelected }: UploadPanelProps) {
  return (
    <section className="upload-panel" aria-label="Upload evaluation artifact">
      <div className="upload-icon" aria-hidden="true">
        <Upload size={32} />
      </div>
      <h1>Evaluation Review</h1>
      <p>Upload one evaluation zip. The file is parsed in this browser.</p>
      <label className="file-picker">
        <span>{loading ? "Loading..." : "Choose zip"}</span>
        <input
          aria-label="Upload evaluation zip"
          type="file"
          accept=".zip,application/zip"
          disabled={loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelected(file);
          }}
        />
      </label>
      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Create initial workbench shell**

Create `src/components/Workbench.tsx`:

```tsx
import type { ReviewDataset } from "../domain/types";

interface WorkbenchProps {
  dataset: ReviewDataset;
}

export function Workbench({ dataset }: WorkbenchProps) {
  const firstDialogue = dataset.dialogues[0];

  return (
    <section className="workbench">
      <header className="summary-band">
        <h1>{dataset.artifact}</h1>
        <p>{dataset.dialogues.length} dialogues loaded</p>
      </header>
      <aside className="dialogue-list" aria-label="Dialogue list">
        {dataset.dialogues.map((dialogue) => (
          <button key={dialogue.dialogue_id} className="dialogue-list-item" type="button">
            Dialogue {dialogue.dialogue_id}
          </button>
        ))}
      </aside>
      <section className="detail-pane">
        <h2>Dialogue {firstDialogue?.dialogue_id}</h2>
      </section>
    </section>
  );
}
```

- [ ] **Step 5: Wire App state**

Replace `src/App.tsx` with:

```tsx
import { useState } from "react";
import { Workbench } from "./components/Workbench";
import { UploadPanel } from "./components/UploadPanel";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import type { ReviewDataset } from "./domain/types";

export default function App() {
  const [dataset, setDataset] = useState<ReviewDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setLoading(true);
    setError(null);
    try {
      setDataset(await loadEvaluationZip(file));
    } catch (loadError) {
      setDataset(null);
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      {dataset ? (
        <Workbench dataset={dataset} />
      ) : (
        <UploadPanel loading={loading} error={error} onFileSelected={handleFileSelected} />
      )}
    </main>
  );
}
```

- [ ] **Step 6: Run app interaction test**

Run: `bun test src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit upload flow**

Run:

```bash
git add src/App.tsx src/App.test.tsx src/components/UploadPanel.tsx src/components/Workbench.tsx
git commit -m "feat: add evaluation upload flow"
```

---

### Task 7: Full Workbench Rendering And Annotation Controls

**Files:**
- Create: `src/components/SummaryBar.tsx`
- Create: `src/components/DialogueList.tsx`
- Create: `src/components/DialogueDetail.tsx`
- Create: `src/components/AnnotationPanel.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/styles.css`
- Create: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Write failing workbench tests**

Create `src/components/Workbench.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { normalizeDataset } from "../domain/normalize";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { Workbench } from "./Workbench";

function dataset() {
  return normalizeDataset({
    summary: summaryFixture,
    rowAudits: rowAuditsFixture,
    eventDetails: rowAuditsFixture[0].events,
    predictionRows: predictionRowsFixture,
    failures: failuresFixture
  });
}

describe("Workbench", () => {
  it("renders summary metrics, dialogue text, event comparison, and failure reason", () => {
    render(<Workbench dataset={dataset()} />);

    expect(screen.getByText("36.5%")).toBeInTheDocument();
    expect(screen.getByText("speaker_1:我 8 点 起床")).toBeInTheDocument();
    expect(screen.getByText("unmatched_gold")).toBeInTheDocument();
    expect(screen.getByText("remote provider HTTP 504")).toBeInTheDocument();
  });

  it("saves a dialogue annotation and counts it as exportable", async () => {
    render(<Workbench dataset={dataset()} />);

    await userEvent.selectOptions(screen.getByLabelText("Review status"), "has_issue");
    await userEvent.type(screen.getByLabelText("Review note"), "需要复核");

    expect(screen.getByText("Exportable annotations: 1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run workbench tests to verify they fail**

Run: `bun test src/components/Workbench.test.tsx`

Expected: FAIL because detailed components are not implemented.

- [ ] **Step 3: Create summary bar**

Create `src/components/SummaryBar.tsx`:

```tsx
import { formatCount, formatMetric } from "../domain/format";
import type { EvaluationSummary } from "../domain/types";

interface SummaryBarProps {
  summary: EvaluationSummary;
  reviewedCount: number;
  exportableCount: number;
}

export function SummaryBar({ summary, reviewedCount, exportableCount }: SummaryBarProps) {
  return (
    <header className="summary-band">
      <div>
        <p className="eyebrow">Artifact</p>
        <h1>{summary.artifact}</h1>
      </div>
      <div className="metric-card">
        <span>Overall weighted F1</span>
        <strong>{formatMetric(summary.overall_weighted_f1)}</strong>
      </div>
      {(["actor", "time", "location", "action"] as const).map((field) => (
        <div className="metric-card" key={field}>
          <span>{field}</span>
          <strong>{formatMetric(summary.field_metrics[field].f1)}</strong>
          <small>
            P {formatMetric(summary.field_metrics[field].precision)} / R{" "}
            {formatMetric(summary.field_metrics[field].recall)}
          </small>
        </div>
      ))}
      <div className="metric-card">
        <span>Rows</span>
        <strong>{formatCount(summary.rows_checked)}</strong>
        <small>{formatCount(summary.rows_fully_matched)} fully matched</small>
      </div>
      <div className="metric-card">
        <span>Review</span>
        <strong>{reviewedCount}</strong>
        <small>Exportable annotations: {exportableCount}</small>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create dialogue list**

Create `src/components/DialogueList.tsx`:

```tsx
import type { AnnotationMap } from "../domain/annotations";
import type { EvaluationStatusFilter, ReviewStatusFilter } from "../domain/filters";
import type { DialogueReview } from "../domain/types";

interface DialogueListProps {
  dialogues: DialogueReview[];
  activeDialogueId: string | null;
  annotations: AnnotationMap;
  search: string;
  reviewStatus: ReviewStatusFilter;
  evaluationStatus: EvaluationStatusFilter;
  onSearchChange: (value: string) => void;
  onReviewStatusChange: (value: ReviewStatusFilter) => void;
  onEvaluationStatusChange: (value: EvaluationStatusFilter) => void;
  onSelectDialogue: (dialogueId: string) => void;
}

export function DialogueList(props: DialogueListProps) {
  return (
    <aside className="dialogue-sidebar" aria-label="Dialogue list">
      <div className="filters">
        <input
          aria-label="Search dialogue id"
          value={props.search}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder="Search dialogue_id"
        />
        <select
          aria-label="Review status filter"
          value={props.reviewStatus}
          onChange={(event) => props.onReviewStatusChange(event.target.value as ReviewStatusFilter)}
        >
          <option value="all">All review statuses</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="accepted">Accepted</option>
          <option value="has_issue">Has issue</option>
          <option value="skip">Skipped</option>
        </select>
        <select
          aria-label="Evaluation status filter"
          value={props.evaluationStatus}
          onChange={(event) =>
            props.onEvaluationStatusChange(event.target.value as EvaluationStatusFilter)
          }
        >
          <option value="all">All evaluation results</option>
          <option value="fully_matched">Fully matched</option>
          <option value="unmatched_gold">Unmatched gold</option>
          <option value="unmatched_prediction">Unmatched prediction</option>
          <option value="zero_prediction">Zero prediction</option>
          <option value="failure">Failure</option>
        </select>
      </div>
      <div className="dialogue-list">
        {props.dialogues.map((dialogue) => {
          const audit = dialogue.rowAudit;
          const status = props.annotations[dialogue.dialogue_id]?.review_status ?? "unreviewed";
          return (
            <button
              key={dialogue.dialogue_id}
              className={
                dialogue.dialogue_id === props.activeDialogueId
                  ? "dialogue-list-item active"
                  : "dialogue-list-item"
              }
              type="button"
              onClick={() => props.onSelectDialogue(dialogue.dialogue_id)}
            >
              <span>Dialogue {dialogue.dialogue_id}</span>
              <small>
                gold {audit?.gold_event_count ?? "-"} / pred {audit?.pred_event_count ?? "-"} / matched{" "}
                {audit?.matched_events ?? "-"}
              </small>
              <small>
                {status}
                {dialogue.failure ? " / failure" : ""}
              </small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create dialogue detail**

Create `src/components/DialogueDetail.tsx`:

```tsx
import { formatOptionalMetric } from "../domain/format";
import type { DialogueReview, EventComparison, FieldName } from "../domain/types";

interface DialogueDetailProps {
  dialogue: DialogueReview;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const fields: FieldName[] = ["actor", "time", "location", "action"];

function values(valuesToRender: string[]): string {
  return valuesToRender.length > 0 ? valuesToRender.join(", ") : "-";
}

function EventComparisonCard({ event }: { event: EventComparison }) {
  return (
    <article className="event-card">
      <div className="event-card-header">
        <strong>{event.match_status}</strong>
        <span>F1 {formatOptionalMetric(event.weighted_f1)}</span>
      </div>
      <div className="event-pair">
        <div>
          <p className="eyebrow">Gold</p>
          <p>{event.gold_event?.digest ?? "-"}</p>
        </div>
        <div>
          <p className="eyebrow">Prediction</p>
          <p>{event.pred_event?.digest ?? "-"}</p>
        </div>
      </div>
      <div className="field-grid">
        {fields.map((field) => {
          const comparison = event.fields[field];
          return (
            <div className="field-row" key={field}>
              <strong>{field}</strong>
              <span>gold: {values(comparison.gold)}</span>
              <span>pred: {values(comparison.pred)}</span>
              <span>
                TP {comparison.TP} / FP {comparison.FP} / FN {comparison.FN} / F1{" "}
                {formatOptionalMetric(comparison.f1)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function DialogueDetail({
  dialogue,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext
}: DialogueDetailProps) {
  const audit = dialogue.rowAudit;

  return (
    <section className="detail-pane">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Current dialogue</p>
          <h2>Dialogue {dialogue.dialogue_id}</h2>
          <p>
            gold {audit?.gold_event_count ?? "-"} / pred {audit?.pred_event_count ?? "-"} /
            matched {audit?.matched_events ?? "-"} / unmatched gold {audit?.unmatched_gold ?? "-"} /
            unmatched pred {audit?.unmatched_pred ?? "-"}
          </p>
        </div>
        <div className="nav-buttons">
          <button type="button" disabled={!canGoPrevious} onClick={onPrevious}>
            Previous
          </button>
          <button type="button" disabled={!canGoNext} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
      {dialogue.failure ? <div className="failure-box">{dialogue.failure.reason}</div> : null}
      <section className="dialogue-text">
        {dialogue.dialogue.map((line, index) => (
          <p key={`${dialogue.dialogue_id}-${index}`}>{line}</p>
        ))}
      </section>
      <section className="events-stack">
        {audit?.events.map((event, index) => (
          <EventComparisonCard key={`${event.match_status}-${index}`} event={event} />
        ))}
      </section>
    </section>
  );
}
```

- [ ] **Step 6: Create annotation panel**

Create `src/components/AnnotationPanel.tsx`:

```tsx
import { Download, RotateCcw, Save } from "lucide-react";
import type { ReviewStatus } from "../domain/types";

interface AnnotationPanelProps {
  status: ReviewStatus;
  note: string;
  exportableCount: number;
  onStatusChange: (status: ReviewStatus) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
  onClearCurrent: () => void;
  onClearAll: () => void;
  onExport: () => void;
}

export function AnnotationPanel(props: AnnotationPanelProps) {
  return (
    <section className="annotation-panel" aria-label="Dialogue annotation">
      <label>
        Review status
        <select
          aria-label="Review status"
          value={props.status}
          onChange={(event) => props.onStatusChange(event.target.value as ReviewStatus)}
        >
          <option value="unreviewed">Unreviewed</option>
          <option value="accepted">Accepted</option>
          <option value="has_issue">Has issue</option>
          <option value="skip">Skip</option>
        </select>
      </label>
      <label>
        Review note
        <textarea
          aria-label="Review note"
          value={props.note}
          onChange={(event) => props.onNoteChange(event.target.value)}
          rows={4}
        />
      </label>
      <div className="annotation-actions">
        <button type="button" onClick={props.onSave}>
          <Save size={16} /> Save current
        </button>
        <button type="button" onClick={props.onClearCurrent}>
          <RotateCcw size={16} /> Clear current
        </button>
        <button type="button" onClick={props.onClearAll}>
          Clear artifact annotations
        </button>
        <button type="button" disabled={props.exportableCount === 0} onClick={props.onExport}>
          <Download size={16} /> Export JSONL
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Replace workbench with full stateful composition**

Modify `src/components/Workbench.tsx` to:

```tsx
import { useMemo, useState } from "react";
import {
  clearAnnotations,
  exportAnnotations,
  getExportableAnnotations,
  loadAnnotations,
  saveAnnotations,
  type AnnotationMap
} from "../domain/annotations";
import { filterDialogues, type EvaluationStatusFilter, type ReviewStatusFilter } from "../domain/filters";
import type { Annotation, ReviewDataset, ReviewStatus, RowAudit } from "../domain/types";
import { AnnotationPanel } from "./AnnotationPanel";
import { DialogueDetail } from "./DialogueDetail";
import { DialogueList } from "./DialogueList";
import { SummaryBar } from "./SummaryBar";

interface WorkbenchProps {
  dataset: ReviewDataset;
}

function rowsByDialogueId(dialogues: ReviewDataset["dialogues"]): Map<string, RowAudit> {
  return new Map(
    dialogues
      .filter((dialogue) => dialogue.rowAudit)
      .map((dialogue) => [dialogue.dialogue_id, dialogue.rowAudit as RowAudit])
  );
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/jsonl;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Workbench({ dataset }: WorkbenchProps) {
  const [annotations, setAnnotations] = useState<AnnotationMap>(() =>
    loadAnnotations(dataset.artifact)
  );
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(
    dataset.dialogues[0]?.dialogue_id ?? null
  );
  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("all");
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatusFilter>("all");

  const filteredDialogues = useMemo(
    () =>
      filterDialogues({
        dialogues: dataset.dialogues,
        annotations,
        search,
        reviewStatus,
        evaluationStatus
      }),
    [annotations, dataset.dialogues, evaluationStatus, reviewStatus, search]
  );

  const activeDialogue =
    filteredDialogues.find((dialogue) => dialogue.dialogue_id === activeDialogueId) ??
    filteredDialogues[0] ??
    dataset.dialogues[0];

  const activeAnnotation = annotations[activeDialogue.dialogue_id] ?? {
    artifact: dataset.artifact,
    dialogue_id: activeDialogue.dialogue_id,
    row_index: activeDialogue.row_index,
    review_status: "unreviewed" as ReviewStatus,
    review_note: "",
    updated_at: ""
  };

  const exportableCount = getExportableAnnotations(annotations).length;
  const reviewedCount = Object.values(annotations).filter(
    (annotation) => annotation.review_status !== "unreviewed"
  ).length;

  function updateActiveAnnotation(next: Partial<Annotation>) {
    const updated: Annotation = {
      ...activeAnnotation,
      ...next,
      updated_at: new Date().toISOString()
    };
    const nextAnnotations = { ...annotations, [activeDialogue.dialogue_id]: updated };
    setAnnotations(nextAnnotations);
    saveAnnotations(dataset.artifact, nextAnnotations);
  }

  function clearCurrent() {
    const nextAnnotations = { ...annotations };
    delete nextAnnotations[activeDialogue.dialogue_id];
    setAnnotations(nextAnnotations);
    saveAnnotations(dataset.artifact, nextAnnotations);
  }

  function clearAll() {
    setAnnotations({});
    clearAnnotations(dataset.artifact);
  }

  function exportJsonl() {
    const jsonl = exportAnnotations({
      annotations,
      rowsByDialogueId: rowsByDialogueId(dataset.dialogues),
      exportedAt: new Date().toISOString()
    });
    downloadText(`${dataset.artifact}-annotations.jsonl`, jsonl);
  }

  const activeIndex = filteredDialogues.findIndex(
    (dialogue) => dialogue.dialogue_id === activeDialogue.dialogue_id
  );

  return (
    <section className="workbench">
      <SummaryBar
        summary={dataset.summary}
        reviewedCount={reviewedCount}
        exportableCount={exportableCount}
      />
      {dataset.warnings.length > 0 ? (
        <div className="warning-strip">{dataset.warnings.join(" ")}</div>
      ) : null}
      <div className="workbench-grid">
        <DialogueList
          dialogues={filteredDialogues}
          activeDialogueId={activeDialogue.dialogue_id}
          annotations={annotations}
          search={search}
          reviewStatus={reviewStatus}
          evaluationStatus={evaluationStatus}
          onSearchChange={setSearch}
          onReviewStatusChange={setReviewStatus}
          onEvaluationStatusChange={setEvaluationStatus}
          onSelectDialogue={setActiveDialogueId}
        />
        <div className="detail-stack">
          <DialogueDetail
            dialogue={activeDialogue}
            canGoPrevious={activeIndex > 0}
            canGoNext={activeIndex >= 0 && activeIndex < filteredDialogues.length - 1}
            onPrevious={() => {
              const previous = filteredDialogues[activeIndex - 1];
              if (previous) setActiveDialogueId(previous.dialogue_id);
            }}
            onNext={() => {
              const next = filteredDialogues[activeIndex + 1];
              if (next) setActiveDialogueId(next.dialogue_id);
            }}
          />
          <AnnotationPanel
            status={activeAnnotation.review_status}
            note={activeAnnotation.review_note}
            exportableCount={exportableCount}
            onStatusChange={(status) => updateActiveAnnotation({ review_status: status })}
            onNoteChange={(note) => updateActiveAnnotation({ review_note: note })}
            onSave={() => updateActiveAnnotation({})}
            onClearCurrent={clearCurrent}
            onClearAll={clearAll}
            onExport={exportJsonl}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Add workbench CSS**

Extend `src/styles.css` with dense workbench styles:

```css
.upload-panel,
.summary-band,
.dialogue-sidebar,
.detail-pane,
.annotation-panel {
  background: #ffffff;
  border: 1px solid #d9e0ea;
  border-radius: 8px;
}

.upload-panel {
  display: grid;
  gap: 16px;
  max-width: 560px;
  margin: 12vh auto;
  padding: 32px;
}

.upload-icon {
  color: #235789;
}

.file-picker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  max-width: 180px;
  border-radius: 6px;
  background: #235789;
  color: #ffffff;
  cursor: pointer;
}

.file-picker input {
  display: none;
}

.error-message,
.failure-box {
  color: #9f1d35;
}

.workbench {
  display: grid;
  gap: 16px;
}

.summary-band {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) repeat(6, minmax(130px, 1fr));
  gap: 12px;
  padding: 16px;
  align-items: stretch;
}

.summary-band h1,
.detail-header h2 {
  margin: 0;
}

.metric-card {
  display: grid;
  gap: 4px;
  padding: 10px;
  background: #f5f7fb;
  border: 1px solid #e0e6ef;
  border-radius: 6px;
}

.metric-card strong {
  font-size: 1.3rem;
}

.eyebrow {
  margin: 0 0 4px;
  color: #657187;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.warning-strip {
  padding: 12px 14px;
  border: 1px solid #ecd38a;
  border-radius: 8px;
  background: #fff8df;
}

.workbench-grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.dialogue-sidebar {
  display: grid;
  gap: 12px;
  padding: 12px;
  max-height: calc(100vh - 170px);
  overflow: auto;
}

.filters {
  display: grid;
  gap: 8px;
}

.filters input,
.filters select,
.annotation-panel select,
.annotation-panel textarea {
  width: 100%;
  border: 1px solid #c9d2df;
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
}

.dialogue-list {
  display: grid;
  gap: 8px;
}

.dialogue-list-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  text-align: left;
  border: 1px solid #d9e0ea;
  border-radius: 6px;
  background: #ffffff;
  color: #18202f;
}

.dialogue-list-item.active {
  border-color: #235789;
  background: #edf5ff;
}

.dialogue-list-item small,
.metric-card small {
  color: #657187;
}

.detail-stack {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.detail-pane,
.annotation-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.nav-buttons,
.annotation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

button {
  min-height: 36px;
  border: 1px solid #c9d2df;
  border-radius: 6px;
  background: #ffffff;
  color: #18202f;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.dialogue-text {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e0e6ef;
  border-radius: 6px;
  background: #f8fafc;
}

.dialogue-text p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.events-stack {
  display: grid;
  gap: 12px;
}

.event-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d9e0ea;
  border-radius: 6px;
}

.event-card-header,
.event-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field-grid {
  display: grid;
  gap: 8px;
}

.field-row {
  display: grid;
  grid-template-columns: 90px repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
}

.field-row span,
.event-pair p {
  overflow-wrap: anywhere;
}

.annotation-panel label {
  display: grid;
  gap: 6px;
}

.annotation-actions button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0 10px;
}

@media (max-width: 980px) {
  .summary-band,
  .workbench-grid,
  .event-card-header,
  .event-pair,
  .field-row {
    grid-template-columns: 1fr;
  }

  .dialogue-sidebar {
    max-height: none;
  }
}
```

- [ ] **Step 9: Run workbench tests**

Run: `bun test src/components/Workbench.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit workbench UI**

Run:

```bash
git add src/components/SummaryBar.tsx src/components/DialogueList.tsx src/components/DialogueDetail.tsx src/components/AnnotationPanel.tsx src/components/Workbench.tsx src/components/Workbench.test.tsx src/styles.css
git commit -m "feat: render dialogue review workbench"
```

---

### Task 8: README, Build Verification, And Browser Check

**Files:**
- Create: `README.md`
- Modify: `src/styles.css` only if browser checks reveal layout issues.

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# Benchmark Audit

Static review site for LLM information-extraction evaluation artifacts.

## Local Development

Install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```

Run the site:

```bash
bun dev
```

Build static output:

```bash
bun run build
```

## Usage

1. Open the site.
2. Upload one evaluation zip.
3. Review the summary and per-dialogue gold/prediction comparison.
4. Set a dialogue-level review status and note.
5. Export changed annotations as JSONL.

The zip is processed in the browser. No evaluation data is uploaded to a server by this app.

## Vercel

Use Vercel's static frontend defaults:

- Build command: `bun run build`
- Output directory: `dist`
- Install command: `bun install`
```

- [ ] **Step 2: Run full verification**

Run: `bun test`

Expected: PASS.

Run: `bun run build`

Expected: PASS and `dist/` is created.

- [ ] **Step 3: Start local app for browser verification**

Run: `bun dev`

Expected: Vite reports a localhost URL.

Open the URL in the browser and verify:

- Upload screen renders.
- `/Users/ChenYu/Downloads/google_gemma_4_31B_it.zip` loads without an error.
- Summary shows artifact `google_gemma_4_31B_it`.
- Dialogue `56` shows the Chinese dialogue text.
- Event comparison shows unmatched gold rows.
- Changing status and note updates exportable count.
- Export JSONL downloads a file with one JSON line after one annotation.
- Desktop layout has no overlapping text.

- [ ] **Step 4: Stop local app**

Stop the Vite process after browser verification.

- [ ] **Step 5: Commit docs and any final visual fixes**

Run:

```bash
git add README.md src/styles.css
git commit -m "docs: add review site usage notes"
```

If `src/styles.css` did not change in this task, commit only `README.md`.

---

## Final Verification

- [ ] Run `bun test`; expected PASS.
- [ ] Run `bun run build`; expected PASS.
- [ ] Run browser verification with the sample zip; expected upload, dashboard, dialogue detail, annotation persistence, and JSONL export all work.
- [ ] Run `git status --short`; expected no unstaged tracked changes.

## Spec Coverage Self-Review

- Single-user browser workflow: covered by upload flow, local parsing, and localStorage annotations.
- One evaluation zip input: covered by `loadEvaluationZip` and `UploadPanel`.
- Browser-side unzip: covered by JSZip service and zip tests.
- Report dashboard: covered by `SummaryBar`.
- Dialogue workbench: covered by `Workbench`, `DialogueList`, and `DialogueDetail`.
- Dialogue-level status and note: covered by `AnnotationPanel` and annotation module.
- JSONL export: covered by `exportAnnotations` tests and export UI.
- Vercel static deployment: covered by Vite build and README instructions.
- Error handling: covered by missing file tests and upload error display; optional failures handling is covered by zip tests without the failures file.
