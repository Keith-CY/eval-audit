# Gold Topic Dataset Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a third top-level `Gold topic dataset` tab that loads gold topic JSONL files, displays attention-sorted case coverage, and supports local case/message notes export and clearing.

**Architecture:** Add focused domain parsing and derived coverage types, then a dedicated workbench component for the three-column review UI. Wire the new dataset through `App.tsx` without changing the evaluation zip or semantic event audit import paths.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, existing `parseJsonl` and `UploadPanel` helpers.

---

### Task 1: Domain Types And Parser

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/loadGoldTopicDataset.ts`
- Test: `src/domain/loadGoldTopicDataset.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add tests that create a JSONL `File` with two cases. Assert parsing produces summary totals, message required-topic coverage, warning records for missing topic message references, and attention sorting with the warning-heavy case first. Add one malformed row test that expects the source line in the error.

- [ ] **Step 2: Run parser test and verify it fails**

Run: `bun test src/domain/loadGoldTopicDataset.test.ts`
Expected: fail because `loadGoldTopicDataset` does not exist.

- [ ] **Step 3: Add types and parser**

Define `GoldTopicDataset`, `GoldTopicCase`, `GoldTopicMessage`, `GoldTopic`, `GoldTopicDatasetSummary`, `GoldTopicWarning`, `GoldTopicNoteScope`, and `GoldTopicNoteExport` in `types.ts`. Implement `loadGoldTopicDataset`, `parseGoldTopicDatasetText`, `buildGoldTopicNoteExports`, and helper validation in `loadGoldTopicDataset.ts`.

- [ ] **Step 4: Run parser test and verify it passes**

Run: `bun test src/domain/loadGoldTopicDataset.test.ts`
Expected: pass.

### Task 2: Gold Topic Workbench Component

**Files:**
- Create: `src/components/GoldTopicDatasetWorkbench.tsx`
- Test: `src/components/GoldTopicDatasetWorkbench.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Render a small `GoldTopicDataset`. Assert summary metrics, attention-first case list, matrix required cells, message detail, case note textarea, message note textarea, disabled export button before notes, enabled export after notes, and clear notes behavior.

- [ ] **Step 2: Run component test and verify it fails**

Run: `bun test src/components/GoldTopicDatasetWorkbench.test.tsx`
Expected: fail because the component does not exist.

- [ ] **Step 3: Implement component and styles**

Build the three-column workbench with search/filter state, selected case/message state, local notes state, `Export notes JSONL`, and `Clear notes`. Use browser download APIs for export and `window.confirm` before clearing.

- [ ] **Step 4: Run component test and verify it passes**

Run: `bun test src/components/GoldTopicDatasetWorkbench.test.tsx`
Expected: pass.

### Task 3: App Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing app test**

Add an app test that clicks `Gold topic dataset`, uploads JSONL, and sees the workbench with the case id and message detail.

- [ ] **Step 2: Run app test and verify it fails**

Run: `bun test src/App.test.tsx`
Expected: fail because the tab does not exist.

- [ ] **Step 3: Wire tab and loader**

Add `gold-topic` to `ActiveTab`, add dataset/loading/error state, wire `loadGoldTopicDataset`, render `UploadPanel` with JSONL labels, and render `GoldTopicDatasetWorkbench` on successful load.

- [ ] **Step 4: Run app test and verify it passes**

Run: `bun test src/App.test.tsx`
Expected: pass.

### Task 4: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:
- `bun test src/domain/loadGoldTopicDataset.test.ts`
- `bun test src/components/GoldTopicDatasetWorkbench.test.tsx`
- `bun test src/App.test.tsx`

Expected: all pass.

- [ ] **Step 2: Run typecheck and build**

Run:
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`
- `node_modules/.bin/tsc --noEmit -p tsconfig.node.json`
- `node_modules/.bin/vite build`

Expected: all exit 0.

- [ ] **Step 3: Check diff hygiene**

Run: `git diff --check`
Expected: no whitespace errors.
