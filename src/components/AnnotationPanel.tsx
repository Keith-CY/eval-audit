import { Download, RotateCcw, Save } from "lucide-react";
import type { ReviewStatus } from "../domain/types";

interface AnnotationPanelProps {
  status: ReviewStatus;
  note: string;
  exportableCount: number;
  disabled?: boolean;
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
          rows={4}
        />
      </label>
      <div className="annotation-actions">
        <button type="button" disabled={props.disabled} onClick={props.onSave}>
          <Save size={16} /> Save current
        </button>
        <button type="button" disabled={props.disabled} onClick={props.onClearCurrent}>
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
