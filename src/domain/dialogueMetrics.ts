import type { DialogueReview } from "./types";

export function dialogueF1(dialogue: DialogueReview | null): number | null {
  const events = dialogue?.rowAudit?.events ?? [];
  if (events.length === 0) return null;

  return events.reduce((total, event) => total + event.weighted_f1, 0) / events.length;
}
