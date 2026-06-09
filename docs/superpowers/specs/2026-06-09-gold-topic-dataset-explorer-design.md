# Gold Topic Dataset Explorer Design

## Goal

Add a third top-level tab for visual analysis of gold topic dataset JSONL files like `test-00000-of-00001.jsonl`. The tool should help a reviewer inspect topic segmentation gold data in the browser without mutating the uploaded file or mixing this workflow into the existing evaluation and semantic audit tabs.

## Input Shape

The tab accepts a `.jsonl` file where each line is one gold topic case. The expected case fields include:

- `gold_case_id`
- `source_dialogue_id`
- `expected_topic_count_range`
- `messages`
- `gold_topics`
- `forbidden_unassigned_message_ids`
- `allowed_unassigned_message_ids`
- `allowed_fallback_reasons`
- `expected_skip_or_fallback_reasons`
- `notes`
- `slices`

Each message contains `message_id`, `sender`, `text`, and `timestamp`. Each gold topic contains `gold_topic_id`, `label`, `description`, `required_message_ids`, `topic_weight`, `boundary_mode`, and `criticality`. Sparse topic fields such as `optional_bridge_message_ids`, `allowed_multi_topic_message_ids`, `may_merge_with`, and `may_split_into` are parsed and retained for details, but they are not part of the default matrix layer.

## Product Shape

Create an independent `Gold topic dataset` top-level tab. The tab uses the existing upload panel pattern with a JSONL-specific title, description, button label, accepted extension, and accessible input label.

After upload, the workbench uses a three-column review layout:

- Left: case list
- Center: topic coverage matrix
- Right: message-centric detail and notes

The default workflow is to review the highest-attention cases first, select suspicious message rows in the matrix, then read the message text and topic coverage in the detail pane.

## Data Model

`GoldTopicDataset` stores:

- `artifact`
- `cases`
- `summary`
- `warnings`

`GoldTopicDatasetSummary` stores:

- total cases
- total messages
- total topics
- average messages per case
- average topics per case
- cases with warnings
- cases with allowed unassigned messages
- cases with fallback or skip reasons

`GoldTopicCase` stores the raw case identifiers and constraints, plus derived fields:

- `attentionScore`
- `attentionReasons`
- message id reference warnings
- topic count range consistency

`GoldTopicMessage` stores the message fields plus derived coverage:

- `requiredTopicIds`
- `isForbiddenUnassigned`
- `isAllowedUnassigned`

`GoldTopic` stores the topic fields, including sparse constraints for the detail surface.

`GoldTopicNote` is the export record type. It supports two scopes:

- `case`
- `message`

Each exported note line includes:

```json
{"artifact":"test-00000-of-00001.jsonl","gold_case_id":"gpt55-draft-001","source_dialogue_id":"dlg-18381b2919b9","scope":"message","message_id":"json:json-342:0001","note":"Boundary looks too broad.","updated_at":"2026-06-09T00:00:00.000Z"}
```

## Parsing And Validation

The parser should read the JSONL with the existing `parseJsonl` helper. It should fail the file for structural errors that make the dataset unusable:

- a row is not an object
- `gold_case_id` is missing or not a non-empty string
- `messages` is missing or not an array
- `gold_topics` is missing or not an array
- a message is missing a non-empty `message_id` or `text`
- a topic is missing a non-empty `gold_topic_id`, `label`, or `required_message_ids` array

The parser should produce warnings instead of rejecting the file for reviewable data quality issues:

- a topic references a missing message id
- `expected_topic_count_range` does not include the actual topic count
- a forbidden or allowed unassigned id does not exist in the case messages
- duplicated message ids inside a case
- duplicated topic ids inside a case

Warnings contribute to attention scoring and are visible in the case list and warning strip.

## Attention Sorting

The default case order is `Needs attention first`. A case scores higher when it has:

- parser warnings
- more topics
- more messages
- higher required coverage density
- allowed unassigned messages
- fallback or expected skip reasons
- existing case or message notes

The UI does not need a visible sort switch in the first version because the approved default is attention-first. Search and filters are enough for navigation.

## UI Behavior

The summary band shows:

- artifact name
- cases
- messages
- topics
- average topics per case
- allowed unassigned cases
- fallback cases
- notes count

Warnings appear in a warning strip below the summary band.

The case list supports:

- search by `gold_case_id` and `source_dialogue_id`
- filters for all cases, warnings, allowed unassigned, fallback, and notes
- visible attention reasons on each case item

The matrix shows:

- message rows
- topic columns
- required coverage cells only
- a row-level unassigned status badge
- selected message state

Topic column headers should show a short label and topic id. Full label and description are available from the detail pane through the selected message's required topic chips.

The right detail pane is message-centric:

- case note textarea
- selected message metadata
- selected message text
- required topic chips with label and id
- unassigned status
- message note textarea

The toolbar includes:

- `Export notes JSONL`
- `Clear notes`

`Export notes JSONL` is disabled when there are no notes. `Clear notes` asks for confirmation before clearing all notes for the loaded dataset.

## Notes Behavior

Notes live in React state for the loaded dataset. They are not written to the original JSONL and they are not merged into the existing review or semantic audit feedback schemas.

Export creates a JSONL download with one note per line. Case notes and message notes use the same schema, with `message_id` omitted or set to `null` for case notes. Empty notes are not exported.

Clear removes all case and message notes for the loaded dataset. Importing notes is out of scope for the first version.

## Error Handling

Upload errors should follow the existing app pattern:

- show a readable error message in the upload panel
- keep the upload input available
- clear the previous dataset on failed load

Parser error messages should include the file name and line number where possible.

Warnings should not block review. They should be summarized globally and attached to the affected case.

## Testing

Add domain tests for:

- parsing a valid JSONL file into cases, messages, topics, summary, and derived coverage
- attention sorting signals
- warning on missing referenced message ids
- rejection of structurally invalid rows
- note export record creation

Add app/component tests for:

- selecting the `Gold topic dataset` tab
- uploading JSONL and seeing the workbench
- default attention-first case ordering
- selecting a message row and seeing message-centric details
- writing case and message notes
- exporting notes JSONL button enabled only when notes exist
- clearing notes after confirmation

Use the repo's existing Vitest and Testing Library style. If root Vitest hits the known parent-directory permission issue, verify from a writable `/private/tmp` copy as previously established for this repo.

## Out Of Scope

- prediction comparison
- model scoring
- note import or state restoration
- server-side persistence
- changing the existing evaluation zip tab
- changing the existing semantic event audit tab
- rendering all sparse topic constraints as matrix overlays
