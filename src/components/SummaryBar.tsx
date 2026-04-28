import { formatCount, formatMetric } from "../domain/format";
import type { EvaluationSummary } from "../domain/types";

interface SummaryBarProps {
  summary: EvaluationSummary;
  reviewedCount: number;
  exportableCount: number;
}

const fields = ["actor", "time", "location", "action"] as const;

export function SummaryBar({ summary, reviewedCount, exportableCount }: SummaryBarProps) {
  return (
    <header className="summary-band">
      <div>
        <p className="eyebrow">Artifact</p>
        <h1>{summary.artifact}</h1>
      </div>
      <div className="metric-card">
        <span>Overall weighted F1</span>
        <strong>{formatMetric(summary.overall_weighted_f1)}</strong>
      </div>
      {fields.map((field) => (
        <div className="metric-card" key={field}>
          <span>{field}</span>
          <strong>{formatMetric(summary.field_metrics[field].f1)}</strong>
          <small>
            P {formatMetric(summary.field_metrics[field].precision)} / R{" "}
            {formatMetric(summary.field_metrics[field].recall)}
          </small>
        </div>
      ))}
      <div className="metric-card">
        <span>Rows</span>
        <strong>{formatCount(summary.rows_checked)}</strong>
        <small>{formatCount(summary.rows_fully_matched)} fully matched</small>
      </div>
      <div className="metric-card">
        <span>Review</span>
        <strong>{reviewedCount}</strong>
        <small>Exportable annotations: {exportableCount}</small>
      </div>
    </header>
  );
}
