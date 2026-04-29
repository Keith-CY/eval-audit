import type { EventComparison, EventNote } from "./types";

function nullableIndex(value: number | null): string {
  return value === null ? "none" : String(value);
}

export function eventNoteKey(event: EventComparison, eventIndex: number): string {
  return [
    event.match_status ?? "unknown",
    nullableIndex(event.gold_event_index),
    nullableIndex(event.pred_event_index),
    eventIndex
  ].join(":");
}

function eventNoteMetadata(event: EventComparison, eventIndex: number): Omit<EventNote, "note"> {
  return {
    event_key: eventNoteKey(event, eventIndex),
    event_index: eventIndex,
    match_status: event.match_status ?? "unknown",
    gold_event_index: event.gold_event_index,
    pred_event_index: event.pred_event_index
  };
}

export function eventNoteFor(
  eventNotes: EventNote[],
  event: EventComparison,
  eventIndex: number
): EventNote | undefined {
  const key = eventNoteKey(event, eventIndex);
  return eventNotes.find((eventNote) => eventNote.event_key === key);
}

export function upsertEventNote(
  eventNotes: EventNote[],
  event: EventComparison,
  eventIndex: number,
  note: string
): EventNote[] {
  const key = eventNoteKey(event, eventIndex);
  const remaining = eventNotes.filter((eventNote) => eventNote.event_key !== key);

  if (note.length === 0) {
    return remaining;
  }

  return [
    ...remaining,
    {
      ...eventNoteMetadata(event, eventIndex),
      note
    }
  ].sort((left, right) => left.event_index - right.event_index);
}
