import { BarChart3, RefreshCw, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import {
  loadBenchmarkArchive,
  type ArchiveError,
  type BenchmarkArchive,
  type BenchmarkArchiveRow,
  type MetricComparison,
  type PerformanceIssue
} from "../domain/loadBenchmarkArchive";
import type { FieldName } from "../domain/types";

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toFixed(3);
}

function formatTokens(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value.toFixed(2)} tok/s`;
}

function formatMillis(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value.toFixed(2)} ms`;
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toLocaleString("en-US");
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }

  return `${scaled.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value >= 60) {
    return `${(value / 60).toFixed(2)} min`;
  }

  return `${value.toFixed(2)} s`;
}

function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  const absolute = Math.abs(value);
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  if (absolute >= 100) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (absolute >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function statusClass(status: string): string {
  if (status === "completed") {
    return "status-badge status-completed";
  }
  if (status === "failed") {
    return "status-badge status-failed";
  }
  return "status-badge status-muted";
}

function fieldLabel(field: FieldName): string {
  return field[0].toUpperCase() + field.slice(1);
}

function issueTitle(issue: PerformanceIssue): string {
  if (/insufficient memory|outofmemory|out of memory|memoryerror/i.test(issue.message)) {
    return "Insufficient Memory";
  }
  if (/disk space/i.test(issue.message)) {
    return "Disk space";
  }
  return issue.severity === "error" ? "Resource error" : "Resource warning";
}

function RankingCard({
  label,
  row,
  value
}: {
  label: string;
  row: BenchmarkArchiveRow | null;
  value: string;
}) {
  return (
    <div className="benchmark-kpi">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <small>{row?.repoId ?? "-"}</small>
    </div>
  );
}

function BenchmarkScatterChart({ rows }: { rows: BenchmarkArchiveRow[] }) {
  const points = rows.filter(
    (row) => row.tokensPerSecond !== null && row.overallWeightedF1 !== null
  );
  const width = 680;
  const height = 300;
  const padding = { top: 28, right: 24, bottom: 48, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xValues = points.map((row) => row.tokensPerSecond as number);
  const yValues = points.map((row) => row.overallWeightedF1 as number);
  const minX = Math.min(...xValues, 0);
  const maxX = Math.max(...xValues, 1);
  const minY = Math.min(...yValues, 0);
  const maxY = Math.max(...yValues, 1);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  function x(value: number): number {
    return padding.left + ((value - minX) / xRange) * chartWidth;
  }

  function y(value: number): number {
    return padding.top + chartHeight - ((value - minY) / yRange) * chartHeight;
  }

  if (points.length === 0) {
    return (
      <div className="empty-chart" aria-label="Benchmark vs evaluation chart">
        No rows contain both benchmark throughput and evaluation F1.
      </div>
    );
  }

  return (
    <svg
      className="scatter-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Benchmark vs evaluation chart"
    >
      <line
        x1={padding.left}
        y1={padding.top + chartHeight}
        x2={padding.left + chartWidth}
        y2={padding.top + chartHeight}
      />
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartHeight}
      />
      <text x={padding.left + chartWidth / 2} y={height - 10} textAnchor="middle">
        tokens/sec
      </text>
      <text x={18} y={padding.top + chartHeight / 2} textAnchor="middle" transform="rotate(-90 18 150)">
        weighted F1
      </text>
      <text x={padding.left} y={padding.top + chartHeight + 20}>
        {minX.toFixed(0)}
      </text>
      <text x={padding.left + chartWidth} y={padding.top + chartHeight + 20} textAnchor="end">
        {maxX.toFixed(0)}
      </text>
      <text x={padding.left - 8} y={padding.top + chartHeight} textAnchor="end">
        {minY.toFixed(2)}
      </text>
      <text x={padding.left - 8} y={padding.top + 4} textAnchor="end">
        {maxY.toFixed(2)}
      </text>
      {points.map((row) => (
        <g
          key={row.repoId}
          transform={`translate(${x(row.tokensPerSecond as number)} ${y(
            row.overallWeightedF1 as number
          )})`}
        >
          <circle className={row.status === "completed" ? "point-complete" : "point-partial"} r="6" />
          <title>
            {row.repoId}: {formatTokens(row.tokensPerSecond)}, F1{" "}
            {formatRatio(row.overallWeightedF1)}
          </title>
        </g>
      ))}
    </svg>
  );
}

function FieldF1Stack({ row }: { row: BenchmarkArchiveRow }) {
  const fields: FieldName[] = ["actor", "time", "location", "action"];

  return (
    <div className="field-f1-stack">
      {fields.map((field) => {
        const value = row.fieldF1[field] ?? null;
        const width = value === null ? 0 : Math.max(0, Math.min(100, value * 100));
        return (
          <div className="field-f1-row" key={field}>
            <span>{fieldLabel(field)}</span>
            <div className="bar-track">
              <span className="bar-fill" style={{ width: `${width}%` }} />
            </div>
            <strong>{formatRatio(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceReports({ archive }: { archive: BenchmarkArchive }) {
  const { performance } = archive;
  const slowestCommand = [...performance.commands]
    .filter((command) => command.elapsedSeconds !== null)
    .sort((left, right) => (right.elapsedSeconds ?? 0) - (left.elapsedSeconds ?? 0))[0];
  const largestCacheEntry = [...performance.cacheEntries].sort(
    (left, right) => right.sizeBytes - left.sizeBytes
  )[0];
  const sortedCommands = [...performance.commands].sort(
    (left, right) => (right.elapsedSeconds ?? -1) - (left.elapsedSeconds ?? -1)
  );
  const sortedCacheEntries = [...performance.cacheEntries].sort(
    (left, right) => right.sizeBytes - left.sizeBytes
  );

  return (
    <section className="performance-reports-wrap">
      <div className="panel-heading">
        <h2>Performance reports</h2>
      </div>
      <div className="performance-summary">
        <div>
          <span>Peak memory</span>
          <strong>
            {performance.peakMemoryBytes === null
              ? "Peak memory not captured"
              : formatBytes(performance.peakMemoryBytes)}
          </strong>
        </div>
        <div>
          <span>Hardware metrics</span>
          <strong>
            {performance.instrumentationGaps.length > 0
              ? "Instrumentation gap"
              : "Captured"}
          </strong>
        </div>
        <div>
          <span>Largest cache</span>
          <strong>{formatBytes(largestCacheEntry?.sizeBytes)}</strong>
          <small>{largestCacheEntry?.repoId ?? "-"}</small>
        </div>
        <div>
          <span>Slowest command</span>
          <strong>{formatSeconds(slowestCommand?.elapsedSeconds)}</strong>
          <small>{slowestCommand?.name ?? "-"}</small>
        </div>
      </div>

      {performance.instrumentationGaps.length > 0 ? (
        <div className="performance-note">
          {performance.instrumentationGaps.map((gap) => (
            <p key={`${gap.source}-${gap.status ?? ""}`}>
              <strong>{gap.status ?? "instrumentation_gap"}</strong>
              <span>{gap.message}</span>
              <small>{gap.source}</small>
            </p>
          ))}
        </div>
      ) : null}

      {sortedCommands.length > 0 ? (
        <div className="performance-table-scroll">
          <h3>Command timings</h3>
          <table className="performance-table" aria-label="Command timing performance report">
            <thead>
              <tr>
                <th>Model</th>
                <th>Phase</th>
                <th>Command</th>
                <th>Elapsed</th>
                <th>Return</th>
                <th>Timeout</th>
              </tr>
            </thead>
            <tbody>
              {sortedCommands.map((command, index) => (
                <tr key={`${command.name}-${index}`}>
                  <td>{command.repoId ?? "-"}</td>
                  <td>{command.phase}</td>
                  <td>{command.name}</td>
                  <td>{formatSeconds(command.elapsedSeconds)}</td>
                  <td>{command.returncode ?? "-"}</td>
                  <td>{command.timeout ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {sortedCacheEntries.length > 0 ? (
        <div className="performance-table-scroll">
          <h3>Model cache sizes</h3>
          <table className="performance-table" aria-label="Model cache size report">
            <thead>
              <tr>
                <th>Model</th>
                <th>Size</th>
                <th>Exists</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {sortedCacheEntries.map((entry) => (
                <tr key={`${entry.repoId}-${entry.path}`}>
                  <td>{entry.repoId}</td>
                  <td>{formatBytes(entry.sizeBytes)}</td>
                  <td>{entry.exists ? "yes" : "no"}</td>
                  <td>{entry.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {performance.resourceIssues.length > 0 ? (
        <div className="performance-table-scroll">
          <h3>Resource issues</h3>
          <table className="performance-table" aria-label="Resource issues report">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {performance.resourceIssues.map((issue, index) => (
                <tr key={`${issue.source}-${index}`}>
                  <td>
                    <strong>{issueTitle(issue)}</strong>
                  </td>
                  <td>{issue.severity}</td>
                  <td>{issue.source}</td>
                  <td>{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function MetricMatrix({
  metrics,
  rows
}: {
  metrics: MetricComparison[];
  rows: BenchmarkArchiveRow[];
}) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <section className="metric-matrix-wrap">
      <div className="panel-heading">
        <h2>All quantitative metrics</h2>
      </div>
      <div className="matrix-scroll">
        <table className="metric-matrix" aria-label="All quantitative benchmark evaluation metrics">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Source</th>
              <th>Unit</th>
              {rows.map((row) => (
                <th key={row.repoId}>{row.repoId}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <th scope="row">
                  <span>{metric.label}</span>
                  <small>{metric.key}</small>
                </th>
                <td>{metric.source}</td>
                <td>{metric.unit ?? "-"}</td>
                {rows.map((row) => (
                  <td key={row.repoId}>{formatMetricValue(metric.values[row.repoId])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ErrorTable({ errors }: { errors: ArchiveError[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <section className="benchmark-errors-wrap">
      <div className="panel-heading">
        <h2>Benchmark errors</h2>
      </div>
      <table className="benchmark-errors" aria-label="Benchmark evaluation errors">
        <thead>
          <tr>
            <th>Model</th>
            <th>Source</th>
            <th>Dialogue</th>
            <th>Line</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, index) => (
            <tr key={`${error.repoId}-${error.source}-${error.dialogueId ?? ""}-${index}`}>
              <td>{error.repoId}</td>
              <td>{error.source}</td>
              <td>{error.dialogueId ?? "-"}</td>
              <td>{error.lineNumber ?? "-"}</td>
              <td>{error.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BenchmarkDashboard({ archive }: { archive: BenchmarkArchive }) {
  const [selectedRepoId, setSelectedRepoId] = useState(archive.rows[0]?.repoId ?? null);
  const selectedRow =
    archive.rows.find((row) => row.repoId === selectedRepoId) ?? archive.rows[0] ?? null;
  const sortedRows = useMemo(
    () =>
      [...archive.rows].sort((left, right) => {
        const rightScore = right.overallWeightedF1 ?? -1;
        const leftScore = left.overallWeightedF1 ?? -1;
        return rightScore - leftScore;
      }),
    [archive.rows]
  );

  return (
    <section className="benchmark-dashboard">
      <div className="benchmark-hero">
        <div>
          <p className="eyebrow">{archive.fileName}</p>
          <h1>Benchmark / Evaluation Compare</h1>
          <p className="benchmark-meta">
            {archive.manifest?.dataset_id ?? "Unknown dataset"}
            {archive.manifest?.commit ? ` · ${archive.manifest.commit.slice(0, 12)}` : ""}
          </p>
        </div>
        <div className="benchmark-run-meta">
          <span>{archive.manifest?.scoring_mode ?? "weighted_f1"}</span>
          <span>{archive.manifest?.timestamp ?? archive.title}</span>
        </div>
      </div>

      {archive.warnings.length > 0 ? (
        <div className="warning-strip" role="status">
          {archive.warnings.join(" ")}
        </div>
      ) : null}

      <div className="benchmark-kpis">
        <div className="benchmark-kpi">
          <p className="eyebrow">Models</p>
          <strong>{archive.totals.modelCount}</strong>
          <small>{archive.totals.completedBoth} completed both</small>
        </div>
        <div className="benchmark-kpi">
          <p className="eyebrow">Benchmark complete</p>
          <strong>{archive.totals.benchmarkCompleted}</strong>
          <small>{archive.totals.failed} failed overall</small>
        </div>
        <div className="benchmark-kpi">
          <p className="eyebrow">Evaluation complete</p>
          <strong>{archive.totals.evaluationCompleted}</strong>
          <small>{archive.manifest?.schema_version ?? "archive summary"}</small>
        </div>
        <RankingCard
          label="Best evaluation F1"
          row={archive.bestEvaluation}
          value={formatRatio(archive.bestEvaluation?.overallWeightedF1)}
        />
        <RankingCard
          label="Fastest benchmark"
          row={archive.fastestBenchmark}
          value={formatTokens(archive.fastestBenchmark?.tokensPerSecond)}
        />
      </div>

      <div className="benchmark-layout">
        <section className="chart-panel">
          <div className="panel-heading">
            <BarChart3 size={18} aria-hidden="true" />
            <h2>Score vs throughput</h2>
          </div>
          <BenchmarkScatterChart rows={archive.rows} />
        </section>

        <aside className="model-detail" aria-label="Selected model details">
          {selectedRow ? (
            <>
              <p className="eyebrow">Selected model</p>
              <h2>{selectedRow.repoId}</h2>
              <div className="detail-metrics">
                <span>Benchmark</span>
                <strong className={statusClass(selectedRow.benchmarkStatus)}>
                  {selectedRow.benchmarkStatus}
                </strong>
                <span>Evaluation</span>
                <strong className={statusClass(selectedRow.evaluationStatus)}>
                  {selectedRow.evaluationStatus}
                </strong>
                <span>TTFT</span>
                <strong>{formatMillis(selectedRow.ttftMs)}</strong>
                <span>Events written</span>
                <strong>{formatCount(selectedRow.eventsWritten)}</strong>
              </div>
              <FieldF1Stack row={selectedRow} />
              {selectedRow.failureReason ? (
                <p className="failure-box">{selectedRow.failureReason}</p>
              ) : null}
            </>
          ) : (
            <p>No model rows found.</p>
          )}
        </aside>
      </div>

      <section className="comparison-table-wrap">
        <div className="panel-heading">
          <h2>Model comparison</h2>
        </div>
        <table className="comparison-table" aria-label="Benchmark evaluation model comparison">
          <thead>
            <tr>
              <th>Model</th>
              <th>Status</th>
              <th>Benchmark</th>
              <th>Evaluation</th>
              <th>Weighted F1</th>
              <th>Tokens/sec</th>
              <th>TTFT</th>
              <th>Unmatched</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const f1Width =
                row.overallWeightedF1 === null
                  ? 0
                  : Math.max(0, Math.min(100, row.overallWeightedF1 * 100));
              return (
                <tr key={row.repoId} className={row.repoId === selectedRow?.repoId ? "selected-row" : ""}>
                  <td>
                    <button
                      type="button"
                      className="model-link"
                      onClick={() => setSelectedRepoId(row.repoId)}
                    >
                      {row.repoId}
                    </button>
                  </td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td>
                    <span className={statusClass(row.benchmarkStatus)}>
                      {row.benchmarkStatus}
                    </span>
                  </td>
                  <td>
                    <span className={statusClass(row.evaluationStatus)}>
                      {row.evaluationStatus}
                    </span>
                  </td>
                  <td>
                    <div className="score-cell">
                      <span>{formatRatio(row.overallWeightedF1)}</span>
                      <div className="bar-track">
                        <span className="bar-fill" style={{ width: `${f1Width}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>{formatTokens(row.tokensPerSecond)}</td>
                  <td>{formatMillis(row.ttftMs)}</td>
                  <td>
                    {formatCount(row.eventsUnmatchedGold)} /{" "}
                    {formatCount(row.eventsUnmatchedPred)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <PerformanceReports archive={archive} />
      <MetricMatrix metrics={archive.metricComparisons} rows={archive.rows} />
      <ErrorTable errors={archive.errors} />
    </section>
  );
}

interface BenchmarkArchivePageProps {
  onBackToEvaluation: () => void;
}

export function BenchmarkArchivePage({ onBackToEvaluation }: BenchmarkArchivePageProps) {
  const [archive, setArchive] = useState<BenchmarkArchive | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      setArchive(await loadBenchmarkArchive(file));
    } catch (loadError) {
      setArchive(null);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load benchmark archive"
      );
    } finally {
      setLoading(false);
      setDragActive(false);
    }
  }

  function pickDroppedFile(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  return (
    <section className="benchmark-page">
      <div
        className={`archive-dropzone ${archive ? "compact" : ""} ${
          dragActive ? "drag-active" : ""
        }`}
        aria-label="Drop benchmark archive zip"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          pickDroppedFile(event.dataTransfer.files);
        }}
      >
        <div className="upload-icon" aria-hidden="true">
          <UploadCloud size={32} />
        </div>
        {archive ? (
          <div>
            <p className="eyebrow">Archive loaded</p>
            <strong>{archive.fileName}</strong>
          </div>
        ) : (
          <div>
            <h1>Benchmark / Evaluation Compare</h1>
            <p>Drop a Melix benchmark/evaluation archive or choose a zip file.</p>
          </div>
        )}
        <div className="archive-actions">
          <label className="file-picker">
            <span>{loading ? "Loading..." : "Choose zip"}</span>
            <input
              aria-label="Upload benchmark archive zip"
              type="file"
              accept=".zip,application/zip"
              disabled={loading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />
          </label>
          <button type="button" onClick={onBackToEvaluation}>
            Evaluation review
          </button>
          {archive ? (
            <button type="button" onClick={() => setArchive(null)}>
              <RefreshCw size={16} aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {archive ? <BenchmarkDashboard archive={archive} /> : null}
    </section>
  );
}
