# Evaluation Review Site Design

## Goal

Build a Vercel-deployable static website for manually reviewing LLM information-extraction evaluation results. A reviewer uploads one evaluation zip, inspects the report and per-dialogue evaluation details, adds dialogue-level annotations, and exports those annotations as JSONL.

The first target dataset is an evaluation artifact like `google_gemma_4_31B_it.zip`, which contains gold data, model predictions, row-level audit output, event-level matching details, summary metrics, and extraction failures.

## Scope

In scope:

- Single-user local browser workflow.
- One upload input: the evaluation zip.
- Browser-side unzip and parsing. The zip is not uploaded to a server.
- Report dashboard for model-level metrics.
- Workbench UI for reviewing one dialogue at a time while keeping the full dialogue list visible.
- Dialogue-level annotations with status and free-text note.
- Browser local storage for annotation persistence per artifact.
- JSONL export of changed annotations.
- Deployment as a static Vercel site without API routes.

Out of scope:

- User accounts, authentication, shared storage, or multi-reviewer coordination.
- Server-side zip processing.
- Editing gold events or predicted events.
- Event-level or field-level human annotation.
- CSV export in the first version.

## Input Files

The application expects the uploaded zip to contain these logical files, possibly nested under an artifact directory:

- `event_eval_summary.json`: overall metrics, field metrics, row counts, alignment settings, and artifact name.
- `row_audit_report.jsonl`: one row per dialogue with row counts and event match details.
- `event_eval_details.jsonl`: event-level audit records. This can be used as a supplemental detail source and consistency check.
- A prediction JSONL file such as `google_gemma-4-31B-it.jsonl`: dialogue text, gold events, and predicted events.
- An optional failures JSONL file such as `google_gemma-4-31B-it.failures.jsonl`: extraction or provider failures.
- Optional CSV files are ignored in the first version because their data is already available in JSON/JSONL files.

The app identifies files by basename and suffix rather than by a fixed top-level directory name.

## Data Flow

1. The reviewer opens the static site and uploads an evaluation zip.
2. The browser unzips the file with JSZip.
3. The parser finds required JSON/JSONL files and reports missing files before continuing.
4. JSONL files are parsed line by line, preserving file name and line number for error messages.
5. Dialogue records are joined by `dialogue_id` and `row_index`:
   - row audit data provides counts and event-level comparison details;
   - prediction data provides dialogue text, gold events, and predicted events;
   - summary data provides global metrics;
   - failures data marks affected dialogues.
6. The normalized in-memory model powers the dashboard, list filters, detail view, and annotation state.
7. Annotations are stored in `localStorage` under a key scoped by artifact name.
8. Export produces one JSONL line for each changed annotation.

## Workbench UI

The primary layout is a two-column audit workbench.

Top summary band:

- Artifact/model name.
- Overall weighted F1.
- Field metrics for `actor`, `time`, `location`, and `action`, including precision, recall, and F1.
- Dataset counters such as rows checked, rows fully matched, unmatched gold, unmatched prediction, zero-prediction rows, and failure count.
- Current annotation progress: reviewed count and exportable annotation count.

Left column:

- Search by `dialogue_id`.
- Review status filter: all, unreviewed, accepted, has issue, skipped.
- Evaluation filter: all, fully matched, unmatched gold, unmatched prediction, zero prediction, failure.
- Dialogue list showing `dialogue_id`, row index, gold count, predicted count, matched count, unmatched counts, review status, and warning/failure markers.

Right column:

- Current dialogue header with counts and weighted F1 summary.
- Dialogue text grouped by speaker line.
- Gold/prediction comparison:
  - matched events shown side by side;
  - unmatched gold events called out separately;
  - unmatched predicted events called out separately;
  - fields `actor`, `time`, `location`, and `action` show gold values, predicted values, TP/FP/FN, and field F1 where available.
- Failure detail block when the dialogue has a failure entry.
- Annotation panel with status and note.
- Navigation controls for previous/next visible dialogue, save current annotation, clear current annotation, clear all annotations for the current artifact, and export JSONL.

## Annotation Model

Annotations are dialogue-level only.

Allowed statuses:

- `unreviewed`
- `accepted`
- `has_issue`
- `skip`

Stored annotation fields:

- `artifact`
- `dialogue_id`
- `row_index`
- `review_status`
- `review_note`
- `updated_at`

The app treats an annotation as exportable when `review_status` is not `unreviewed` or `review_note` is non-empty.

## JSONL Export

Each exported line contains the human annotation plus useful row context:

```json
{
  "artifact": "google_gemma_4_31B_it",
  "dialogue_id": "56",
  "row_index": 0,
  "review_status": "has_issue",
  "review_note": "模型没有抽出任何事件，需要复核。",
  "gold_event_count": 5,
  "pred_event_count": 0,
  "matched_events": 0,
  "unmatched_gold": 5,
  "unmatched_pred": 0,
  "exported_at": "2026-04-29T00:00:00.000Z"
}
```

The first version exports only JSONL. The button is disabled when there are no exportable annotations.

## Error Handling

- If the zip cannot be opened, show a clear upload error and keep the upload screen available.
- If required files are missing, show the missing logical file list and do not enter the workbench.
- If a core JSON/JSONL file has invalid syntax, show the file name and line number and stop loading.
- If an optional failures file has invalid syntax, show a warning and continue without failure data.
- If row audit and prediction JSONL data do not align perfectly, join what can be joined and show a top-level consistency warning.
- If existing local annotations are found for the artifact, restore them automatically and show the restored count.
- Provide a clear destructive action for clearing annotations for the current artifact.

## Testing Plan

Unit tests:

- Zip file discovery and required-file validation.
- JSONL parsing with line-numbered error reporting.
- Normalization and joining by `dialogue_id` and `row_index`.
- Summary metric formatting.
- Annotation storage, restoration, clearing, and export filtering.
- JSONL export line shape and escaping.
- Filtering and search logic.

Integration tests:

- Upload the sample evaluation zip.
- Verify summary metrics render.
- Select a dialogue and inspect dialogue text plus gold/pred comparison.
- Change annotation status and note, navigate away, and verify persistence.
- Export JSONL and verify the exported records.

Manual visual checks:

- Desktop workbench layout at common Vercel/browser viewport sizes.
- Long Chinese dialogue lines and long failure messages wrap without overlapping.
- Empty and invalid upload states are readable.

## Implementation Direction

Use a small Vite frontend with Bun for local package operations. The production output is static files that can be deployed directly to Vercel. Keep parsing, normalization, storage, and export logic in small testable modules, with React components focused on rendering and interaction.

