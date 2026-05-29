import { parseJsonl } from "./jsonl";
import type { FieldName, FlatEventRecord, FlatEventsDataset } from "./types";

export const FLAT_EVENTS_JSONL_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024
};

type FlatEventWithLine = Omit<FlatEventRecord, "source_order"> & {
  lineNumber: number;
  source_order: number | null;
};

const fields: FieldName[] = ["actor", "time", "location", "action"];
const preferredSourceOrder = ["gold", "base", "lora"];

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function assertFileWithinLimits(file: File): void {
  if (file.size > FLAT_EVENTS_JSONL_LIMITS.maxFileBytes) {
    throw new Error(
      `Flat events JSONL is too large. Maximum supported size is ${formatMegabytes(
        FLAT_EVENTS_JSONL_LIMITS.maxFileBytes
      )}.`
    );
  }
}

function asRecord(value: unknown, sourceName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${sourceName}: row must be an object`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, sourceName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${sourceName}: ${field} must be a non-empty string`);
  }

  return value;
}

function optionalString(value: unknown, field: string, sourceName: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${sourceName}: ${field} must be a string or null`);
  }

  return value;
}

function optionalNumber(value: unknown, field: string, sourceName: string): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${sourceName}: ${field} must be a finite number or null`);
  }

  return value;
}

function optionalStringArray(
  value: unknown,
  field: string,
  sourceName: string
): string[] | null {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${sourceName}: ${field} must be an array of strings or null`);
  }

  return value;
}

function normalizeFlatEvent(
  rawRecord: unknown,
  sourceName: string,
  lineNumber: number
): FlatEventWithLine {
  const record = asRecord(rawRecord, sourceName);

  const event: FlatEventWithLine = {
    source: requiredString(record.source, "source", sourceName),
    dialogue_id: requiredString(record.dialogue_id, "dialogue_id", sourceName),
    outcome: optionalString(record.outcome, "outcome", sourceName),
    typed_score: optionalNumber(record.typed_score, "typed_score", sourceName),
    event_index: optionalNumber(record.event_index, "event_index", sourceName),
    source_order: optionalNumber(record.source_order, "source_order", sourceName),
    digest: optionalString(record.digest, "digest", sourceName) ?? undefined,
    lineNumber
  };

  for (const field of fields) {
    event[field] = optionalStringArray(record[field], field, sourceName);
  }

  return event;
}

function compareEvents(a: FlatEventWithLine, b: FlatEventWithLine): number {
  return (
    (a.source_order ?? Number.MAX_SAFE_INTEGER) -
      (b.source_order ?? Number.MAX_SAFE_INTEGER) ||
    (a.event_index ?? Number.MAX_SAFE_INTEGER) - (b.event_index ?? Number.MAX_SAFE_INTEGER) ||
    a.lineNumber - b.lineNumber
  );
}

function compareSources(a: string, b: string): number {
  const aIndex = preferredSourceOrder.indexOf(a);
  const bIndex = preferredSourceOrder.indexOf(b);

  if (aIndex >= 0 || bIndex >= 0) {
    return (aIndex >= 0 ? aIndex : preferredSourceOrder.length) -
      (bIndex >= 0 ? bIndex : preferredSourceOrder.length);
  }

  return a.localeCompare(b);
}

function publicEvent(event: FlatEventWithLine): FlatEventRecord {
  return {
    source: event.source,
    dialogue_id: event.dialogue_id,
    outcome: event.outcome,
    typed_score: event.typed_score,
    event_index: event.event_index,
    actor: event.actor,
    time: event.time,
    location: event.location,
    action: event.action,
    digest: event.digest,
    source_order: event.source_order ?? undefined
  };
}

export function parseFlatEventsText(text: string, sourceName: string, artifact: string): FlatEventsDataset {
  const rawRecords = parseJsonl<unknown>(text, sourceName);
  const records = rawRecords.map((record, index) =>
    normalizeFlatEvent(record, `${sourceName} line ${index + 1}`, index + 1)
  );

  const sources = [...new Set(records.map((record) => record.source))].sort(compareSources);
  const sourceCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  const byDialogue = new Map<string, FlatEventWithLine[]>();

  for (const record of records) {
    sourceCounts[record.source] = (sourceCounts[record.source] ?? 0) + 1;
    if (record.outcome) {
      outcomeCounts[record.outcome] = (outcomeCounts[record.outcome] ?? 0) + 1;
    }

    const existing = byDialogue.get(record.dialogue_id);
    if (existing) {
      existing.push(record);
    } else {
      byDialogue.set(record.dialogue_id, [record]);
    }
  }

  const dialogues = [...byDialogue.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId, undefined, { numeric: true }))
    .map(([dialogueId, dialogueRecords]) => {
      const outcomes = [
        ...new Set(dialogueRecords.flatMap((record) => (record.outcome ? [record.outcome] : [])))
      ].sort((a, b) => a.localeCompare(b));
      const typedScores: Record<string, number | null> = {};
      const eventsBySource: Record<string, FlatEventRecord[]> = {};

      for (const source of sources) {
        const sourceEvents = dialogueRecords
          .filter((record) => record.source === source)
          .sort(compareEvents);

        if (sourceEvents.length > 0) {
          typedScores[source] = sourceEvents.find((event) => event.typed_score !== null)
            ?.typed_score ?? null;
          eventsBySource[source] = sourceEvents.map(publicEvent);
        }
      }

      return {
        dialogue_id: dialogueId,
        outcome: outcomes.length === 1 ? outcomes[0] : outcomes.length > 1 ? "mixed" : null,
        outcomes,
        typedScores,
        eventsBySource,
        totalEvents: dialogueRecords.length
      };
    });

  return {
    artifact,
    totalEvents: records.length,
    sources,
    sourceCounts,
    outcomeCounts,
    dialogues,
    warnings: records.length === 0 ? ["Flat events JSONL did not contain any events."] : []
  };
}

export async function loadFlatEventsJsonl(file: File): Promise<FlatEventsDataset> {
  assertFileWithinLimits(file);
  const text = await file.text();
  return parseFlatEventsText(text, file.name, file.name);
}
