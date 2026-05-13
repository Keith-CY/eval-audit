import JSZip from "jszip";
import type { FieldName } from "./types";

export const BENCHMARK_ARCHIVE_LIMITS = {
  maxZipBytes: 100 * 1024 * 1024,
  maxEntries: 1_500,
  maxTextChars: 50 * 1024 * 1024
};

export interface BenchmarkArchiveManifest {
  commit?: string;
  dataset_id?: string;
  model_order?: string[];
  schema_version?: string;
  scoring_mode?: string;
  timestamp?: string;
}

export interface BenchmarkArchiveTotals {
  modelCount: number;
  benchmarkCompleted: number;
  evaluationCompleted: number;
  completedBoth: number;
  failed: number;
}

export interface BenchmarkArchiveRow {
  repoId: string;
  status: string;
  benchmarkStatus: string;
  evaluationStatus: string;
  benchmarkJobId: string | null;
  evaluationJobId: string | null;
  failureReason: string | null;
  overallWeightedF1: number | null;
  eventsFailed: number | null;
  eventsWritten: number | null;
  eventsUnmatchedGold: number | null;
  eventsUnmatchedPred: number | null;
  tokensPerSecond: number | null;
  ttftMs: number | null;
  fieldF1: Partial<Record<FieldName, number>>;
  benchmarkMetrics: Record<string, number>;
}

export interface MetricComparison {
  key: string;
  label: string;
  source: string;
  unit: string | null;
  values: Record<string, number | null>;
}

export interface ArchiveError {
  repoId: string;
  source: string;
  message: string;
  dialogueId?: string;
  lineNumber?: number;
}

export interface PerformanceCommand {
  name: string;
  repoId: string | null;
  phase: string;
  elapsedSeconds: number | null;
  returncode: number | null;
  timeout: boolean;
}

export interface PerformanceCacheEntry {
  repoId: string;
  label: string;
  path: string;
  exists: boolean;
  sizeBytes: number;
}

export interface PerformanceIssue {
  source: string;
  message: string;
  severity: "warning" | "error";
}

export interface InstrumentationGap {
  source: string;
  message: string;
  status: string | null;
}

export interface PerformanceReport {
  peakMemoryBytes: number | null;
  instrumentationGaps: InstrumentationGap[];
  commands: PerformanceCommand[];
  cacheEntries: PerformanceCacheEntry[];
  resourceIssues: PerformanceIssue[];
}

export interface BenchmarkArchive {
  title: string;
  fileName: string;
  manifest: BenchmarkArchiveManifest | null;
  rows: BenchmarkArchiveRow[];
  totals: BenchmarkArchiveTotals;
  bestEvaluation: BenchmarkArchiveRow | null;
  fastestBenchmark: BenchmarkArchiveRow | null;
  metricComparisons: MetricComparison[];
  errors: ArchiveError[];
  performance: PerformanceReport;
  warnings: string[];
}

type CsvRecord = Record<string, string>;

interface MetricValueBucket {
  sum: number;
  count: number;
}

interface MetricBucket {
  key: string;
  label: string;
  source: string;
  unit: string | null;
  order: number;
  values: Record<string, MetricValueBucket>;
}

interface JsonlRecord {
  value: unknown;
  lineNumber: number;
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function isMacOsMetadata(path: string): boolean {
  return path.includes("__MACOSX/") || basename(path).startsWith("._");
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function assertZipFileWithinLimits(file: File): void {
  if (file.size > BENCHMARK_ARCHIVE_LIMITS.maxZipBytes) {
    throw new Error(
      `Benchmark archive is too large. Maximum supported size is ${formatMegabytes(
        BENCHMARK_ARCHIVE_LIMITS.maxZipBytes
      )}.`
    );
  }
}

function assertEntryCountWithinLimits(paths: string[]): void {
  if (paths.length > BENCHMARK_ARCHIVE_LIMITS.maxEntries) {
    throw new Error(
      `Benchmark archive contains too many files. Maximum supported entries is ${BENCHMARK_ARCHIVE_LIMITS.maxEntries}.`
    );
  }
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Zip entry not found: ${path}`);
  }

  const text = await entry.async("text");
  if (text.length > BENCHMARK_ARCHIVE_LIMITS.maxTextChars) {
    throw new Error(
      `${path} is too large after decompression. Maximum supported text size is ${formatMegabytes(
        BENCHMARK_ARCHIVE_LIMITS.maxTextChars
      )}.`
    );
  }

  return text;
}

function parseJson<T>(sourceName: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${sourceName}: ${(error as Error).message}`);
  }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function parseCsv(text: string): CsvRecord[] {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim().length > 0));
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  if (headers.length === 0) {
    return [];
  }

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]))
  );
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalString(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function optionalRecordString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberFromUnknown(value: unknown, allowNumericStrings = false): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (!allowNumericStrings || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeRepoId(repoId: string): string {
  return repoId.replaceAll("/", "__");
}

function findSummaryPath(paths: string[]): string | null {
  return (
    paths
      .filter((path) => basename(path) === "summary.csv")
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
      .at(0) ?? null
  );
}

function findManifestPath(paths: string[], summaryPath: string): string | null {
  const expected = `${dirname(summaryPath)}/manifest.json`;
  return paths.includes(expected)
    ? expected
    : paths.find((path) => basename(path) === "manifest.json") ?? null;
}

function relativeArchivePath(summaryPath: string, path: string): string {
  const root = dirname(summaryPath);
  return root.length > 0 && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function findArchiveFilePath(
  paths: string[],
  summaryPath: string,
  relativePath: string
): string | null {
  const root = dirname(summaryPath);
  const expected = root.length > 0 ? `${root}/${relativePath}` : relativePath;
  return paths.includes(expected)
    ? expected
    : paths.find((path) => path.endsWith(`/${relativePath}`) || path === relativePath) ?? null;
}

function findBenchmarkRunPath(paths: string[], repoId: string): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  return (
    paths.find((path) => path.endsWith(`/models/${modelDirectory}/benchmark/bench-run.json`)) ??
    null
  );
}

function findBenchmarkCsvPath(paths: string[], repoId: string): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  return (
    paths.find((path) => path.endsWith(`/models/${modelDirectory}/benchmark/benchmark.csv`)) ??
    null
  );
}

function findEvaluationRunPath(paths: string[], repoId: string): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  return (
    paths.find((path) => path.endsWith(`/models/${modelDirectory}/evaluation/eval-run.json`)) ??
    null
  );
}

function findModelRunResultPath(paths: string[], repoId: string): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  return paths.find((path) => path.endsWith(`/models/${modelDirectory}/run-result.json`)) ?? null;
}

function findEvaluationSummaryPath(paths: string[], repoId: string): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  const directPath = paths.find((path) =>
    path.endsWith(`/models/${modelDirectory}/evaluation/raw-artifacts/event_eval_summary.json`)
  );
  if (directPath) {
    return directPath;
  }

  return (
    paths.find(
      (path) =>
        path.includes(`/models/${modelDirectory}/evaluation/`) &&
        basename(path) === "event_eval_summary.json" &&
        !path.includes("/report-dir-")
    ) ?? null
  );
}

function findEvaluationArtifactPath(
  paths: string[],
  repoId: string,
  fileName: string
): string | null {
  const modelDirectory = sanitizeRepoId(repoId);
  const directPath = paths.find((path) =>
    path.endsWith(`/models/${modelDirectory}/evaluation/raw-artifacts/${fileName}`)
  );
  if (directPath) {
    return directPath;
  }

  return (
    paths
      .filter(
        (path) =>
          path.includes(`/models/${modelDirectory}/evaluation/`) &&
          basename(path) === fileName &&
          !path.includes("/report-dir-")
      )
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
      .at(0) ?? null
  );
}

function metricLabel(key: string): string {
  return key
    .replace(/^(summary|benchmark|evaluation|run_result)\./, "")
    .replaceAll(".", " / ")
    .replaceAll("_", " ");
}

function inferUnitFromKey(key: string): string | null {
  const lower = key.toLowerCase();
  if (lower.includes("tokens_per_second") || lower.includes("tok/s")) {
    return "tok/s";
  }
  if (lower.endsWith("_ms") || lower.includes("duration_ms") || lower.includes("unix_ms")) {
    return lower.includes("unix_ms") ? "unix ms" : "ms";
  }
  if (lower.endsWith("_seconds") || lower.includes("duration_seconds")) {
    return "s";
  }
  if (lower.endsWith("_bytes") || lower.includes("body_bytes")) {
    return "bytes";
  }
  if (
    lower.includes("f1") ||
    lower.includes("precision") ||
    lower.includes("recall") ||
    lower.includes("rate") ||
    lower.includes("score") ||
    lower.includes("weight")
  ) {
    return "ratio";
  }
  if (
    lower.includes("count") ||
    lower.includes("events_") ||
    lower.includes("_tp") ||
    lower.includes("_fp") ||
    lower.includes("_fn") ||
    lower.includes("matched") ||
    lower.includes("failed") ||
    lower.includes("written") ||
    lower.includes("sample_size") ||
    lower.includes("hits") ||
    lower.includes("misses")
  ) {
    return "count";
  }
  if (lower.includes("mode") || lower.includes("fallback_reason")) {
    return "code";
  }
  return null;
}

function shouldCollectNumericPath(path: string[]): boolean {
  const leaf = path.at(-1) ?? "";
  if (leaf.length === 0) {
    return false;
  }

  if (
    leaf === "id" ||
    leaf === "dialogue_id" ||
    leaf === "line_number" ||
    leaf.endsWith("_id") ||
    leaf.endsWith("_index") ||
    leaf.endsWith("_indices") ||
    leaf.includes("path") ||
    leaf.includes("hash")
  ) {
    return false;
  }

  return true;
}

function collectNumericLeaves(
  value: unknown,
  prefix: string,
  allowNumericStrings = false
): Array<{ key: string; value: number }> {
  const values: Array<{ key: string; value: number }> = [];

  function visit(current: unknown, path: string[]) {
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, path);
      }
      return;
    }

    if (current && typeof current === "object") {
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        visit(child, [...path, key]);
      }
      return;
    }

    const parsed = numberFromUnknown(current, allowNumericStrings);
    if (parsed !== null && shouldCollectNumericPath(path)) {
      values.push({ key: `${prefix}.${path.join(".")}`, value: parsed });
    }
  }

  visit(value, []);
  return values;
}

function parseJsonlRecords(sourceName: string, text: string, warnings: string[]): JsonlRecord[] {
  return text
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return [];
      }

      try {
        return [{ value: JSON.parse(trimmed) as unknown, lineNumber: index + 1 }];
      } catch (error) {
        warnings.push(`${sourceName}:${index + 1}: ${(error as Error).message}`);
        return [];
      }
    });
}

function combineSource(existing: string, next: string): string {
  return existing.split(", ").includes(next) ? existing : `${existing}, ${next}`;
}

class MetricBuilder {
  private readonly buckets = new Map<string, MetricBucket>();
  private nextOrder = 0;

  add(repoId: string, key: string, value: number | null, source: string, unit?: string | null) {
    if (value === null || !Number.isFinite(value)) {
      return;
    }

    const bucket =
      this.buckets.get(key) ??
      ({
        key,
        label: metricLabel(key),
        source,
        unit: unit ?? inferUnitFromKey(key),
        order: this.nextOrder++,
        values: {}
      } satisfies MetricBucket);

    if (this.buckets.has(key)) {
      bucket.source = combineSource(bucket.source, source);
      if (!bucket.unit && unit) {
        bucket.unit = unit;
      }
    } else {
      this.buckets.set(key, bucket);
    }

    const repoBucket = bucket.values[repoId] ?? { sum: 0, count: 0 };
    repoBucket.sum += value;
    repoBucket.count += 1;
    bucket.values[repoId] = repoBucket;
  }

  addLeaves(repoId: string, leaves: Array<{ key: string; value: number }>, source: string) {
    for (const leaf of leaves) {
      this.add(repoId, leaf.key, leaf.value, source, inferUnitFromKey(leaf.key));
    }
  }

  toComparisons(rows: BenchmarkArchiveRow[]): MetricComparison[] {
    return [...this.buckets.values()]
      .sort((left, right) => left.order - right.order)
      .map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        source: bucket.source,
        unit: bucket.unit,
        values: Object.fromEntries(
          rows.map((row) => {
            const value = bucket.values[row.repoId];
            return [row.repoId, value ? value.sum / value.count : null];
          })
        )
      }));
  }
}

function addArchiveError(errors: ArchiveError[], error: ArchiveError) {
  const message = error.message.trim();
  if (message.length === 0) {
    return;
  }

  const existing = errors.find(
    (candidate) =>
      candidate.repoId === error.repoId &&
      candidate.message === message &&
      candidate.dialogueId === error.dialogueId &&
      candidate.lineNumber === error.lineNumber
  );
  if (existing) {
    existing.source = combineSource(existing.source, error.source);
    return;
  }

  errors.push({ ...error, message });
}

function jsonErrorMessage(value: unknown, fallbackStatus = true): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const explicit =
    optionalRecordString(record.reason) ??
    optionalRecordString(record.failure_reason) ??
    optionalRecordString(record.error) ??
    optionalRecordString(record.message) ??
    optionalRecordString(record.error_code);

  if (explicit) {
    return explicit;
  }

  const status = optionalRecordString(record.status);
  if (fallbackStatus && status && status !== "ok" && status !== "completed") {
    return `status: ${status}`;
  }

  return null;
}

function jsonDialogueId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = (value as Record<string, unknown>).dialogue_id;
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : undefined;
}

function jsonLineNumber(value: unknown): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const parsed = numberFromUnknown((value as Record<string, unknown>).line_number, true);
  return parsed === null ? undefined : parsed;
}

function commandPhase(name: string): string {
  if (name.includes("-bench-run")) {
    return "benchmark";
  }
  if (name.includes("-eval-run")) {
    return "evaluation";
  }
  if (name.startsWith("bench-export")) {
    return "benchmark export";
  }
  if (name.includes("server-snapshot")) {
    return "server snapshot";
  }
  if (name.includes("dev-up")) {
    return "runtime start";
  }
  if (name.includes("dev-down")) {
    return "runtime stop";
  }
  if (name.startsWith("host-")) {
    return "host";
  }
  if (name.startsWith("hardware-")) {
    return "hardware";
  }
  return "command";
}

function commandRepoId(name: string, rows: BenchmarkArchiveRow[]): string | null {
  return rows.find((row) => name.includes(sanitizeRepoId(row.repoId)))?.repoId ?? null;
}

function performanceCommandFromJson(value: unknown, rows: BenchmarkArchiveRow[]): PerformanceCommand | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = optionalRecordString(record.name);
  if (!name) {
    return null;
  }

  return {
    name,
    repoId: commandRepoId(name, rows),
    phase: commandPhase(name),
    elapsedSeconds: numberFromUnknown(record.elapsed_seconds, true),
    returncode: numberFromUnknown(record.returncode, true),
    timeout: record.timeout === true
  };
}

function performanceCacheEntryFromJson(value: unknown): PerformanceCacheEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const repoId = optionalRecordString(record.repo_id);
  const sizeBytes = numberFromUnknown(record.size_bytes, true);
  if (!repoId || sizeBytes === null) {
    return null;
  }

  return {
    repoId,
    label: optionalRecordString(record.label) ?? "",
    path: optionalRecordString(record.path) ?? "",
    exists: record.exists === true,
    sizeBytes
  };
}

function issueSeverity(message: string): "warning" | "error" {
  return /insufficient memory|outofmemory|out of memory|memoryerror/i.test(message)
    ? "error"
    : "warning";
}

function resourceIssuesFromLog(source: string, text: string): PerformanceIssue[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.replace(/\r/g, "").trim();
      if (!/insufficient memory|outofmemory|out of memory|memoryerror|not enough free disk space/i.test(trimmed)) {
        return [];
      }

      const normalized = trimmed.replace(/\s+/g, " ");
      if (seen.has(normalized)) {
        return [];
      }
      seen.add(normalized);

      return [
        {
          source,
          message: normalized,
          severity: issueSeverity(normalized)
        }
      ];
    });
}

async function readPerformanceReport(
  zip: JSZip,
  paths: string[],
  summaryPath: string,
  rows: BenchmarkArchiveRow[],
  warnings: string[]
): Promise<PerformanceReport> {
  const performance: PerformanceReport = {
    peakMemoryBytes: null,
    instrumentationGaps: [],
    commands: [],
    cacheEntries: [],
    resourceIssues: []
  };

  const hardwarePath = findArchiveFilePath(paths, summaryPath, "hardware/powermetrics-preflight.json");
  if (hardwarePath) {
    try {
      const hardware = parseJson<unknown>(hardwarePath, await readText(zip, hardwarePath));
      if (hardware && typeof hardware === "object") {
        const record = hardware as Record<string, unknown>;
        const status = optionalRecordString(record.status);
        const returncode = numberFromUnknown(record.returncode, true);
        if (status !== "ok" || (returncode !== null && returncode !== 0)) {
          performance.instrumentationGaps.push({
            source: relativeArchivePath(summaryPath, hardwarePath),
            message:
              optionalRecordString(record.note) ??
              optionalRecordString(record.message) ??
              status ??
              "Hardware instrumentation did not complete.",
            status
          });
        }
      }
    } catch (error) {
      warnings.push((error as Error).message);
    }
  }

  const commandsPath = findArchiveFilePath(paths, summaryPath, "commands.log.jsonl");
  if (commandsPath) {
    try {
      performance.commands = parseJsonlRecords(
        relativeArchivePath(summaryPath, commandsPath),
        await readText(zip, commandsPath),
        warnings
      ).flatMap((record) => {
        const command = performanceCommandFromJson(record.value, rows);
        return command ? [command] : [];
      });
    } catch (error) {
      warnings.push((error as Error).message);
    }
  }

  const cachePath = findArchiveFilePath(paths, summaryPath, "cache-audit/cache-inventory-final.json");
  if (cachePath) {
    try {
      const cache = parseJson<unknown>(cachePath, await readText(zip, cachePath));
      const entries =
        cache && typeof cache === "object" && Array.isArray((cache as { entries?: unknown }).entries)
          ? ((cache as { entries: unknown[] }).entries)
          : [];
      performance.cacheEntries = entries.flatMap((entry) => {
        const parsed = performanceCacheEntryFromJson(entry);
        return parsed ? [parsed] : [];
      });
    } catch (error) {
      warnings.push((error as Error).message);
    }
  }

  const runtimeLogPaths = paths.filter(
    (path) =>
      path.includes("/runtime-logs/") &&
      basename(path).endsWith(".log") &&
      !isMacOsMetadata(path)
  );
  for (const logPath of runtimeLogPaths) {
    try {
      performance.resourceIssues.push(
        ...resourceIssuesFromLog(
          relativeArchivePath(summaryPath, logPath),
          await readText(zip, logPath)
        )
      );
    } catch (error) {
      warnings.push((error as Error).message);
    }
  }

  return performance;
}

function metricRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const metrics = (value as { metrics?: unknown }).metrics;
  if (!metrics || typeof metrics !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metrics as Record<string, unknown>).flatMap(([key, rawValue]) =>
      typeof rawValue === "number" && Number.isFinite(rawValue) ? [[key, rawValue]] : []
    )
  );
}

function fieldF1Record(value: unknown): Partial<Record<FieldName, number>> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const fieldMetrics = (value as { field_metrics?: unknown }).field_metrics;
  if (!fieldMetrics || typeof fieldMetrics !== "object") {
    return {};
  }

  const fields: FieldName[] = ["actor", "time", "location", "action"];
  return Object.fromEntries(
    fields.flatMap((field) => {
      const metric = (fieldMetrics as Record<string, unknown>)[field];
      if (!metric || typeof metric !== "object") {
        return [];
      }

      const f1 = (metric as { f1?: unknown }).f1;
      return typeof f1 === "number" && Number.isFinite(f1) ? [[field, f1]] : [];
    })
  );
}

function archiveTitle(summaryPath: string, fileName: string): string {
  const directory = dirname(summaryPath);
  if (directory.length > 0) {
    return basename(directory);
  }

  return fileName.replace(/\.zip$/i, "");
}

function rowFromCsv(record: CsvRecord): BenchmarkArchiveRow {
  return {
    repoId: record.repo_id ?? "",
    status: optionalString(record.status) ?? "unknown",
    benchmarkStatus: optionalString(record.benchmark_status) ?? "unknown",
    evaluationStatus: optionalString(record.evaluation_status) ?? "unknown",
    benchmarkJobId: optionalString(record.benchmark_job_id),
    evaluationJobId: optionalString(record.evaluation_job_id),
    failureReason: optionalString(record.failure_reason),
    overallWeightedF1: parseOptionalNumber(record.overall_weighted_f1),
    eventsFailed: parseOptionalNumber(record.events_failed),
    eventsWritten: parseOptionalNumber(record.events_written),
    eventsUnmatchedGold: parseOptionalNumber(record.events_unmatched_gold),
    eventsUnmatchedPred: parseOptionalNumber(record.events_unmatched_pred),
    tokensPerSecond: parseOptionalNumber(record.tokens_per_second),
    ttftMs: parseOptionalNumber(record.ttft_ms),
    fieldF1: {},
    benchmarkMetrics: {}
  };
}

function computeTotals(rows: BenchmarkArchiveRow[]): BenchmarkArchiveTotals {
  return {
    modelCount: rows.length,
    benchmarkCompleted: rows.filter((row) => row.benchmarkStatus === "completed").length,
    evaluationCompleted: rows.filter((row) => row.evaluationStatus === "completed").length,
    completedBoth: rows.filter(
      (row) => row.benchmarkStatus === "completed" && row.evaluationStatus === "completed"
    ).length,
    failed: rows.filter((row) => row.status === "failed").length
  };
}

function highestBy(
  rows: BenchmarkArchiveRow[],
  getValue: (row: BenchmarkArchiveRow) => number | null
): BenchmarkArchiveRow | null {
  return rows.reduce<BenchmarkArchiveRow | null>((best, row) => {
    const value = getValue(row);
    if (value === null) {
      return best;
    }

    const bestValue = best ? getValue(best) : null;
    return bestValue === null || value > bestValue ? row : best;
  }, null);
}

export async function loadBenchmarkArchive(file: File): Promise<BenchmarkArchive> {
  assertZipFileWithinLimits(file);

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const usablePaths = Object.keys(zip.files).filter((path) => !isMacOsMetadata(path));
  assertEntryCountWithinLimits(usablePaths);

  const summaryPath = findSummaryPath(usablePaths);
  if (!summaryPath) {
    throw new Error("Missing required benchmark summary.csv");
  }

  const manifestPath = findManifestPath(usablePaths, summaryPath);
  const summaryText = await readText(zip, summaryPath);
  const manifest = manifestPath
    ? parseJson<BenchmarkArchiveManifest>(manifestPath, await readText(zip, manifestPath))
    : null;
  const records = parseCsv(summaryText);
  const warnings: string[] = [];

  if (records.length === 0 || !("repo_id" in records[0])) {
    throw new Error(`${summaryPath}: expected repo_id column`);
  }

  const rowPairs = records
    .map((record) => ({ record, row: rowFromCsv(record) }))
    .filter(({ row }) => row.repoId.length > 0);
  const rows = rowPairs.map(({ row }) => row);
  const metrics = new MetricBuilder();
  const errors: ArchiveError[] = [];

  for (const { record, row } of rowPairs) {
    for (const [key, rawValue] of Object.entries(record)) {
      metrics.add(
        row.repoId,
        `summary.${key}`,
        parseOptionalNumber(rawValue),
        "summary.csv",
        inferUnitFromKey(key)
      );
    }

    if (row.failureReason) {
      addArchiveError(errors, {
        repoId: row.repoId,
        source: "summary.csv",
        message: row.failureReason
      });
    }
  }

  for (const row of rows) {
    const benchmarkRunPath = findBenchmarkRunPath(usablePaths, row.repoId);
    if (benchmarkRunPath) {
      try {
        const benchmarkRun = parseJson<unknown>(
          benchmarkRunPath,
          await readText(zip, benchmarkRunPath)
        );
        row.benchmarkMetrics = metricRecord(benchmarkRun);

        if (benchmarkRun && typeof benchmarkRun === "object") {
          const record = benchmarkRun as { job?: unknown; metrics?: unknown };
          metrics.addLeaves(
            row.repoId,
            collectNumericLeaves(record.job, "benchmark.job", true),
            "bench-run.json"
          );

          if (record.metrics && typeof record.metrics === "object") {
            for (const [key, value] of Object.entries(record.metrics as Record<string, unknown>)) {
              metrics.add(
                row.repoId,
                `benchmark.${key}`,
                numberFromUnknown(value),
                "bench-run.json",
                inferUnitFromKey(key)
              );
            }
          }
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const benchmarkCsvPath = findBenchmarkCsvPath(usablePaths, row.repoId);
    if (benchmarkCsvPath) {
      try {
        for (const record of parseCsv(await readText(zip, benchmarkCsvPath))) {
          const metricName = optionalString(record.metric_name);
          const metricValue = parseOptionalNumber(record.metric_value);
          if (metricName && metricValue !== null) {
            metrics.add(
              row.repoId,
              `benchmark.${metricName}`,
              metricValue,
              "benchmark.csv",
              optionalString(record.unit) ?? inferUnitFromKey(metricName)
            );
          }

          for (const [key, rawValue] of Object.entries(record)) {
            if (key === "metric_value" || key === "metric_name") {
              continue;
            }
            metrics.add(
              row.repoId,
              `benchmark.csv.${key}`,
              parseOptionalNumber(rawValue),
              "benchmark.csv",
              inferUnitFromKey(key)
            );
          }
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const evaluationRunPath = findEvaluationRunPath(usablePaths, row.repoId);
    if (evaluationRunPath) {
      try {
        const evaluationRun = parseJson<unknown>(
          evaluationRunPath,
          await readText(zip, evaluationRunPath)
        );
        const runs = Array.isArray(evaluationRun) ? evaluationRun : [evaluationRun];
        for (const run of runs) {
          if (!run || typeof run !== "object") {
            continue;
          }

          const record = run as { job?: unknown; results?: unknown };
          metrics.addLeaves(
            row.repoId,
            collectNumericLeaves(record.job, "evaluation.run.job", true),
            "eval-run.json"
          );

          if (Array.isArray(record.results)) {
            for (const result of record.results) {
              if (!result || typeof result !== "object") {
                continue;
              }

              const resultRecord = result as { metrics?: unknown };
              metrics.addLeaves(
                row.repoId,
                collectNumericLeaves(
                  Object.fromEntries(
                    Object.entries(resultRecord as Record<string, unknown>).filter(
                      ([key]) => key !== "metrics"
                    )
                  ),
                  "evaluation.run.result",
                  true
                ),
                "eval-run.json"
              );

              if (Array.isArray(resultRecord.metrics)) {
                for (const metric of resultRecord.metrics) {
                  if (!metric || typeof metric !== "object") {
                    continue;
                  }

                  const metricRecord = metric as Record<string, unknown>;
                  const metricName = optionalRecordString(metricRecord.name);
                  const metricValue = numberFromUnknown(metricRecord.value, true);
                  if (metricName && metricValue !== null) {
                    metrics.add(
                      row.repoId,
                      `evaluation.run.${metricName}`,
                      metricValue,
                      "eval-run.json",
                      optionalRecordString(metricRecord.unit) ?? inferUnitFromKey(metricName)
                    );
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const evaluationSummaryPath = findEvaluationSummaryPath(usablePaths, row.repoId);
    if (evaluationSummaryPath) {
      try {
        const evaluationSummary = parseJson<unknown>(
          evaluationSummaryPath,
          await readText(zip, evaluationSummaryPath)
        );
        row.fieldF1 = fieldF1Record(evaluationSummary);
        metrics.addLeaves(
          row.repoId,
          collectNumericLeaves(evaluationSummary, "evaluation.summary"),
          "event_eval_summary.json"
        );
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const jsonlArtifacts = [
      {
        fileName: "event_eval_dialogue_traces.jsonl",
        prefix: "evaluation.dialogue_trace"
      },
      {
        fileName: "event_eval_row_audit.jsonl",
        prefix: "evaluation.row_audit"
      },
      {
        fileName: "event_eval_details.jsonl",
        prefix: "evaluation.detail"
      }
    ];

    for (const artifact of jsonlArtifacts) {
      const artifactPath = findEvaluationArtifactPath(usablePaths, row.repoId, artifact.fileName);
      if (!artifactPath) {
        continue;
      }

      try {
        const records = parseJsonlRecords(
          artifact.fileName,
          await readText(zip, artifactPath),
          warnings
        );
        for (const record of records) {
          metrics.addLeaves(
            row.repoId,
            collectNumericLeaves(record.value, artifact.prefix),
            artifact.fileName
          );

          if (artifact.fileName === "event_eval_dialogue_traces.jsonl") {
            const status =
              record.value && typeof record.value === "object"
                ? optionalRecordString((record.value as Record<string, unknown>).status)
                : null;
            const message = jsonErrorMessage(record.value, status !== "ok");
            if (message && (status !== "ok" || message !== status)) {
              addArchiveError(errors, {
                repoId: row.repoId,
                source: artifact.fileName,
                message,
                dialogueId: jsonDialogueId(record.value),
                lineNumber: jsonLineNumber(record.value)
              });
            }
          }
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const failurePath = findEvaluationArtifactPath(usablePaths, row.repoId, "failure_jsonl.jsonl");
    if (failurePath) {
      try {
        const records = parseJsonlRecords(
          "failure_jsonl.jsonl",
          await readText(zip, failurePath),
          warnings
        );
        for (const record of records) {
          const message = jsonErrorMessage(record.value, false);
          if (message) {
            addArchiveError(errors, {
              repoId: row.repoId,
              source: "failure_jsonl.jsonl",
              message,
              dialogueId: jsonDialogueId(record.value),
              lineNumber: jsonLineNumber(record.value)
            });
          }
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    const runResultPath = findModelRunResultPath(usablePaths, row.repoId);
    if (runResultPath) {
      try {
        const runResult = parseJson<unknown>(runResultPath, await readText(zip, runResultPath));
        metrics.addLeaves(
          row.repoId,
          collectNumericLeaves(runResult, "run_result", true),
          "run-result.json"
        );

        const message = jsonErrorMessage(runResult, true);
        if (message) {
          addArchiveError(errors, {
            repoId: row.repoId,
            source: "run-result.json",
            message
          });
        }
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }
  }

  const performance = await readPerformanceReport(zip, usablePaths, summaryPath, rows, warnings);

  return {
    title: archiveTitle(summaryPath, file.name),
    fileName: file.name,
    manifest,
    rows,
    totals: computeTotals(rows),
    bestEvaluation: highestBy(rows, (row) => row.overallWeightedF1),
    fastestBenchmark: highestBy(rows, (row) => row.tokensPerSecond),
    metricComparisons: metrics.toComparisons(rows),
    errors,
    performance,
    warnings
  };
}
