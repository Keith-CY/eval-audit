import { Download, RotateCcw } from "lucide-react";

interface AnnotationPanelProps {
  exportableCount: number;
  disabled?: boolean;
  onClearCurrent: () => void;
  onClearAll: () => void;
  onExport: () => void;
}

export function AnnotationPanel(props: AnnotationPanelProps) {
  return (
    <section className="annotation-panel" aria-label="Dialogue annotation">
      <div className="annotation-actions">
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
