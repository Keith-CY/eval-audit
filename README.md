# Evaluation Review

A browser-only review workbench for LLM information-extraction evaluation results.

The app lets a reviewer upload one evaluation `.zip`, inspect summary metrics and
dialogue-level gold/prediction comparisons, annotate each dialogue, and export the
annotations as JSONL. The zip is parsed in the browser; no files are uploaded to a
server.

## Expected Artifact

The uploaded zip should include these files, either at the zip root or inside one
common directory:

- `event_eval_summary.json`
- `row_audit_report.jsonl`
- `event_eval_details.jsonl`
- one prediction `.jsonl`
- optional `*.failures.jsonl`

The prediction JSONL supplies dialogue text and model-predicted events. Gold,
prediction, and match details are read from the audit reports.

## Local Development

Use Bun for local commands:

```sh
bun install
bun run dev
```

Run checks before shipping changes:

```sh
bun run test
bun run build
```

## Vercel

This is a static Vite app and can be deployed on Vercel with the default Vite
settings:

- Install command: `bun install`
- Build command: `bun run build`
- Output directory: `dist`

No backend, database, or environment variables are required.

## Annotation Export

Reviewer annotations are saved in browser `localStorage` per artifact name. The
export button downloads a JSONL file containing one record per non-empty
annotation, ordered by `row_index` and `dialogue_id`.

Each exported record includes:

- artifact and dialogue identifiers
- review status and review note
- row-level gold/prediction/match counts when available
- export timestamp
