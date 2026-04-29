import { Save } from "lucide-react";
import type { ReviewStatus } from "../domain/types";

interface InlineAnnotationControlsProps {
  status: ReviewStatus;
  note: string;
  disabled?: boolean;
  onStatusChange: (status: ReviewStatus) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
}

export function InlineAnnotationControls(props: InlineAnnotationControlsProps) {
  return (
    <div className="annotation-inline" aria-label="Primary annotation controls">
      <div className="annotation-inline-fields">
        <label>
          Review status
          <select
            aria-label="Review status"
            disabled={props.disabled}
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
            disabled={props.disabled}
            value={props.note}
            onChange={(event) => props.onNoteChange(event.target.value)}
            rows={3}
          />
        </label>
      </div>
      <button type="button" disabled={props.disabled} onClick={props.onSave}>
        <Save size={16} /> Save current
      </button>
    </div>
  );
}
