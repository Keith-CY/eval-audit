import JSZip from "jszip";
import { parseJsonl } from "./jsonl";
import { parseFlatEventsText } from "./loadFlatEventsJsonl";
import type {
  FieldName,
  FlatEventRecord,
  SemanticAuditDialogue,
  SemanticAuditImportSource,
  SemanticAuditSummary,
  SemanticCandidateScore,
  SemanticEventAuditDataset,
  SemanticEventComparison,
  SemanticFieldComparison,
  SemanticFieldMetric,
  SemanticJudgeAudit,
  SemanticRowAudit
} from "./types";

const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_TEXT_CHARS = 100 * 1024 * 1024;

const fields: FieldName[] = ["actor", "time", "location", "action"];

export const SEMANTIC_AUDIT_REQUIRED_PATHS = {
  readme: "README.md",
  flatEvents: "event-extraction/dialogue-extraction/events.flat.jsonl",
  summary: "event-extraction/semantic-f1/event_eval_semantic_summary.json",
  details: "event-extraction/semantic-f1/event_eval_semantic_details.jsonl",
  rowAudit: "event-extraction/semantic-f1/event_eval_semantic_row_audit.jsonl",
  judgeAudit: "event-extraction/semantic-f1/event_eval_judge_audit.jsonl"
};

const optionalPaths = {
  manifest: "event-extraction/semantic-f1/manifest.json"
};

type ArtifactFiles = Record<string, string>;
type RequiredPathKey = keyof typeof SEMANTIC_AUDIT_REQUIRED_PATHS;

interface SemanticAuditPathLayout {
  name: string;
  required: Record<RequiredPathKey, string>;
  optional: typeof optionalPaths;
}

const requiredPathKeys = Object.keys(SEMANTIC_AUDIT_REQUIRED_PATHS) as RequiredPathKey[];
const semanticAuditPathLayouts: SemanticAuditPathLayout[] = [
  {
    name: "event-extraction directory",
    required: {
      readme: "README.md",
      flatEvents: "dialogue-extraction/events.flat.jsonl",
      summary: "semantic-f1/event_eval_semantic_summary.json",
      details: "semantic-f1/event_eval_semantic_details.jsonl",
      rowAudit: "semantic-f1/event_eval_semantic_row_audit.jsonl",
      judgeAudit: "semantic-f1/event_eval_judge_audit.jsonl"
    },
    optional: {
      manifest: "semantic-f1/manifest.json"
    }
  },
  {
    name: "archive report root",
    required: {
      readme: "event-extraction/README.md",
      flatEvents: "event-extraction/dialogue-extraction/events.flat.jsonl",
      summary: "event-extraction/semantic-f1/event_eval_semantic_summary.json",
      details: "event-extraction/semantic-f1/event_eval_semantic_details.jsonl",
      rowAudit: "event-extraction/semantic-f1/event_eval_semantic_row_audit.jsonl",
      judgeAudit: "event-extraction/semantic-f1/event_eval_judge_audit.jsonl"
    },
    optional: optionalPaths
  },
  {
    name: "legacy archive root",
    required: SEMANTIC_AUDIT_REQUIRED_PATHS,
    optional: optionalPaths
  }
];

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function assertArchiveSize(file: File): void {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error(
      `Archive zip is too large. Maximum supported size is ${formatMegabytes(MAX_ARCHIVE_BYTES)}.`
    );
  }
}

function visibleZipPaths(zip: JSZip): string[] {
  return Object.keys(zip.files).filter((path) => {
    if (zip.files[path].dir) {
      return false;
    }

    const basename = path.split("/").pop() ?? path;
    return !path.startsWith("__MACOSX/") && !basename.startsWith("._");
  });
}

function resolveZipLayout(paths: string[]) {
  const pathSet = new Set(paths);
  let closestMissingPaths: string[] | null = null;

  for (const layout of semanticAuditPathLayouts) {
    const readmePaths = paths.filter(
      (path) =>
        path === layout.required.readme || path.endsWith(`/${layout.required.readme}`)
    );

    for (const readmePath of readmePaths) {
      const root = readmePath.slice(0, -layout.required.readme.length);
      const resolvedRequired = {} as Record<RequiredPathKey, string>;
      const missingPaths = requiredPathKeys.flatMap((key) => {
        const resolvedPath = `${root}${layout.required[key]}`;
        resolvedRequired[key] = resolvedPath;
        return pathSet.has(resolvedPath) ? [] : [resolvedPath];
      });

      if (missingPaths.length === 0) {
        return {
          layout,
          required: resolvedRequired,
          optional: {
            manifest: `${root}${layout.optional.manifest}`
          }
        };
      }

      if (
        closestMissingPaths == null ||
        missingPaths.length < closestMissingPaths.length
      ) {
        closestMissingPaths = missingPaths;
      }
    }
  }

  if (closestMissingPaths) {
    throw new Error(`Missing required files: ${closestMissingPaths.join(", ")}`);
  }

  throw new Error(
    "Archive does not match a semantic audit layout. Expected fixed files under event-extraction/README.md or an event-extraction directory with README.md."
  );
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);

  if (!entry) {
    throw new Error(`Archive entry not found: ${path}`);
  }

  const text = await entry.async("text");
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(
      `${path} is too large after decompression. Maximum supported text size is ${formatMegabytes(
        MAX_TEXT_CHARS
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

function asRecord(value: unknown, sourceName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${sourceName}: expected an object`);
  }

  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeFieldMetric(value: unknown): SemanticFieldMetric {
  const record = asRecord(value, "field metric");

  return {
    weight: numberValue(record.weight),
    precision: numberValue(record.precision),
    recall: numberValue(record.recall),
    f1: numberValue(record.f1),
    tp: numberValue(record.tp),
    fp: numberValue(record.fp),
    fn: numberValue(record.fn)
  };
}

function normalizeSummary(rawSummary: unknown): SemanticAuditSummary {
  const record = asRecord(rawSummary, "event_eval_semantic_summary.json");
  const rawFieldMetrics = asRecord(record.field_metrics ?? {}, "field_metrics");
  const semanticJudge = asRecord(record.semantic_judge ?? {}, "semantic_judge");

  return {
    overallWeightedF1: numberValue(record.overall_weighted_f1),
    strictEventRowAverageF1: numberValue(record.strict_event_row_average_f1),
    softSemanticEventPrecision: numberValue(record.soft_semantic_event_precision),
    softSemanticEventRecall: numberValue(record.soft_semantic_event_recall),
    softSemanticEventF1: numberValue(record.soft_semantic_event_f1),
    matchedEventQuality: numberValue(record.matched_event_quality),
    eventsEvaluated: numberValue(record.events_evaluated),
    eventsMatched: numberValue(record.events_matched),
    eventsUnmatchedGold: numberValue(record.events_unmatched_gold),
    eventsUnmatchedPred: numberValue(record.events_unmatched_pred),
    fieldMetrics: {
      actor: normalizeFieldMetric(rawFieldMetrics.actor ?? {}),
      time: normalizeFieldMetric(rawFieldMetrics.time ?? {}),
      location: normalizeFieldMetric(rawFieldMetrics.location ?? {}),
      action: normalizeFieldMetric(rawFieldMetrics.action ?? {})
    },
    judgeModelId: stringOrNull(semanticJudge.judge_model_id),
    judgePromptVersion: stringOrNull(semanticJudge.judge_prompt_version)
  };
}

function normalizeSemanticMatch(value: unknown) {
  const record = asRecord(value, "semantic match");

  return {
    gold_value: stringOrNull(record.gold_value) ?? "",
    pred_value: stringOrNull(record.pred_value) ?? "",
    score: numberValue(record.score)
  };
}

function normalizeFieldComparison(value: unknown): SemanticFieldComparison {
  const record = asRecord(value, "field comparison");

  return {
    gold: stringArray(record.gold),
    pred: stringArray(record.pred),
    tp: numberValue(record.tp),
    fp: numberValue(record.fp),
    fn: numberValue(record.fn),
    precision: numberValue(record.precision),
    recall: numberValue(record.recall),
    f1: numberValue(record.f1),
    semantic_matches: Array.isArray(record.semantic_matches)
      ? record.semantic_matches.map(normalizeSemanticMatch)
      : []
  };
}

function normalizeAlignmentFields(value: unknown): Partial<Record<FieldName, number>> {
  const record = asRecord(value ?? {}, "alignment_fields");
  const normalized: Partial<Record<FieldName, number>> = {};

  for (const field of fields) {
    if (typeof record[field] === "number") {
      normalized[field] = record[field] as number;
    }
  }

  return normalized;
}

function normalizeDetail(rawDetail: unknown, sourceName: string): Omit<
  SemanticEventComparison,
  "goldEvent" | "predEvent" | "eventJudge" | "fieldJudges"
> {
  const record = asRecord(rawDetail, sourceName);
  const rawFields = asRecord(record.fields ?? {}, `${sourceName} fields`);

  return {
    dialogue_id: stringOrNull(record.dialogue_id) ?? "",
    event_index: numberValue(record.event_index),
    gold_event_index: nullableIndex(record.gold_event_index),
    pred_event_index: nullableIndex(record.pred_event_index),
    match_status: stringOrNull(record.match_status) ?? "unknown",
    weighted_f1: numberValue(record.weighted_f1),
    active_weight: numberValue(record.active_weight),
    alignment_score: numberValue(record.alignment_score),
    semantic_alignment_score: numberValue(record.semantic_alignment_score),
    alignment_fields: normalizeAlignmentFields(record.alignment_fields),
    fields: {
      actor: normalizeFieldComparison(rawFields.actor ?? {}),
      time: normalizeFieldComparison(rawFields.time ?? {}),
      location: normalizeFieldComparison(rawFields.location ?? {}),
      action: normalizeFieldComparison(rawFields.action ?? {})
    }
  };
}

function normalizeCandidateScore(value: unknown): SemanticCandidateScore {
  const record = asRecord(value, "candidate score");

  return {
    gold_event_index: numberValue(record.gold_event_index),
    pred_event_index: numberValue(record.pred_event_index),
    alignment_score: numberValue(record.alignment_score),
    accepted: booleanValue(record.accepted),
    source: stringOrNull(record.source),
    reason_code: stringOrNull(record.reason_code),
    local_alignment_score: nullableNumber(record.local_alignment_score)
  };
}

function normalizeMatchedPair(value: unknown) {
  const record = asRecord(value, "matched pair");

  return {
    gold_event_index: numberValue(record.gold_event_index),
    pred_event_index: numberValue(record.pred_event_index),
    alignment_score: numberValue(record.alignment_score)
  };
}

function normalizeRowAudit(rawRowAudit: unknown, sourceName: string): SemanticRowAudit {
  const record = asRecord(rawRowAudit, sourceName);

  return {
    dialogue_id: stringOrNull(record.dialogue_id) ?? "",
    alignment_strategy: stringOrNull(record.alignment_strategy),
    gold_event_count: numberValue(record.gold_event_count),
    pred_event_count: numberValue(record.pred_event_count),
    matched_pairs: Array.isArray(record.matched_pairs)
      ? record.matched_pairs.map(normalizeMatchedPair)
      : [],
    unmatched_gold_indices: Array.isArray(record.unmatched_gold_indices)
      ? record.unmatched_gold_indices.map(numberValue)
      : [],
    unmatched_pred_indices: Array.isArray(record.unmatched_pred_indices)
      ? record.unmatched_pred_indices.map(numberValue)
      : [],
    candidate_scores: Array.isArray(record.candidate_scores)
      ? record.candidate_scores.map(normalizeCandidateScore)
      : [],
    low_quality_alignment: booleanValue(record.low_quality_alignment),
    low_quality_alignment_threshold: nullableNumber(record.low_quality_alignment_threshold),
    low_quality_alignment_pairs: Array.isArray(record.low_quality_alignment_pairs)
      ? record.low_quality_alignment_pairs
      : []
  };
}

function normalizeJudgeAudit(rawJudgeAudit: unknown, sourceName: string): SemanticJudgeAudit {
  const record = asRecord(rawJudgeAudit, sourceName);

  return {
    dialogue_id: stringOrNull(record.dialogue_id) ?? "",
    kind: stringOrNull(record.kind) ?? "unknown",
    field_name: fields.includes(record.field_name as FieldName)
      ? (record.field_name as FieldName)
      : null,
    comparison_type: stringOrNull(record.comparison_type),
    gold_event_index: nullableIndex(record.gold_event_index),
    pred_event_index: nullableIndex(record.pred_event_index),
    gold_value: stringOrNull(record.gold_value),
    pred_value: stringOrNull(record.pred_value),
    gold_values: Array.isArray(record.gold_values) ? stringArray(record.gold_values) : null,
    pred_values: Array.isArray(record.pred_values) ? stringArray(record.pred_values) : null,
    equivalent: typeof record.equivalent === "boolean" ? record.equivalent : null,
    confidence: nullableNumber(record.confidence),
    reason_code: stringOrNull(record.reason_code),
    short_reason: stringOrNull(record.short_reason),
    source: stringOrNull(record.source),
    status: stringOrNull(record.status),
    cache_key: stringOrNull(record.cache_key)
  };
}

function indexEventsBySemanticIndex(events: FlatEventRecord[]): Map<number, FlatEventRecord> {
  const index = new Map<number, FlatEventRecord>();

  events.forEach((event, position) => {
    index.set(position, event);
    if (typeof event.event_index === "number") {
      index.set(event.event_index - 1, event);
    }
  });

  return index;
}

function judgeMatchesPair(
  judge: SemanticJudgeAudit,
  dialogueId: string,
  goldIndex: number | null,
  predIndex: number | null
): boolean {
  return (
    judge.dialogue_id === dialogueId &&
    judge.gold_event_index === goldIndex &&
    judge.pred_event_index === predIndex
  );
}

function eventJudgeFor(
  judges: SemanticJudgeAudit[],
  dialogueId: string,
  goldIndex: number | null,
  predIndex: number | null
): SemanticJudgeAudit | null {
  return (
    judges.find(
      (judge) =>
        judge.kind === "event" && judgeMatchesPair(judge, dialogueId, goldIndex, predIndex)
    ) ?? null
  );
}

function fieldJudgesFor(
  judges: SemanticJudgeAudit[],
  dialogueId: string,
  goldIndex: number | null,
  predIndex: number | null
): Record<FieldName, SemanticJudgeAudit[]> {
  return {
    actor: judges.filter(
      (judge) =>
        judge.kind === "field" &&
        judge.field_name === "actor" &&
        judgeMatchesPair(judge, dialogueId, goldIndex, predIndex)
    ),
    time: judges.filter(
      (judge) =>
        judge.kind === "field" &&
        judge.field_name === "time" &&
        judgeMatchesPair(judge, dialogueId, goldIndex, predIndex)
    ),
    location: judges.filter(
      (judge) =>
        judge.kind === "field" &&
        judge.field_name === "location" &&
        judgeMatchesPair(judge, dialogueId, goldIndex, predIndex)
    ),
    action: judges.filter(
      (judge) =>
        judge.kind === "field" &&
        judge.field_name === "action" &&
        judgeMatchesPair(judge, dialogueId, goldIndex, predIndex)
    )
  };
}

function averageWeightedF1(comparisons: SemanticEventComparison[]): number {
  if (comparisons.length === 0) {
    return 0;
  }

  return (
    comparisons.reduce((total, comparison) => total + comparison.weighted_f1, 0) /
    comparisons.length
  );
}

function compareDialoguesByPriority(a: SemanticAuditDialogue, b: SemanticAuditDialogue): number {
  const aUnmatched = a.unmatchedGold + a.unmatchedPred;
  const bUnmatched = b.unmatchedGold + b.unmatchedPred;

  return (
    Number(bUnmatched > 0) - Number(aUnmatched > 0) ||
    a.averageWeightedF1 - b.averageWeightedF1 ||
    Number(b.hasLowQualityAlignment) - Number(a.hasLowQualityAlignment) ||
    a.dialogue_id.localeCompare(b.dialogue_id, undefined, { numeric: true })
  );
}

function buildDataset({
  artifact,
  artifactId,
  importSource,
  files
}: {
  artifact: string;
  artifactId: string;
  importSource: SemanticAuditImportSource;
  files: ArtifactFiles;
}): SemanticEventAuditDataset {
  const missingRequired = Object.values(SEMANTIC_AUDIT_REQUIRED_PATHS).filter(
    (path) => files[path] == null
  );

  if (missingRequired.length > 0) {
    throw new Error(`Missing required files: ${missingRequired.join(", ")}`);
  }

  const manifest = files[optionalPaths.manifest]
    ? parseJson<Record<string, unknown>>(optionalPaths.manifest, files[optionalPaths.manifest])
    : {};
  const flatDataset = parseFlatEventsText(
    files[SEMANTIC_AUDIT_REQUIRED_PATHS.flatEvents],
    SEMANTIC_AUDIT_REQUIRED_PATHS.flatEvents,
    artifact
  );
  const summary = normalizeSummary(
    parseJson<unknown>(
      SEMANTIC_AUDIT_REQUIRED_PATHS.summary,
      files[SEMANTIC_AUDIT_REQUIRED_PATHS.summary]
    )
  );
  const details = parseJsonl<unknown>(
    files[SEMANTIC_AUDIT_REQUIRED_PATHS.details],
    SEMANTIC_AUDIT_REQUIRED_PATHS.details
  ).map((detail, index) =>
    normalizeDetail(detail, `${SEMANTIC_AUDIT_REQUIRED_PATHS.details} line ${index + 1}`)
  );
  const rowAudits = parseJsonl<unknown>(
    files[SEMANTIC_AUDIT_REQUIRED_PATHS.rowAudit],
    SEMANTIC_AUDIT_REQUIRED_PATHS.rowAudit
  ).map((rowAudit, index) =>
    normalizeRowAudit(rowAudit, `${SEMANTIC_AUDIT_REQUIRED_PATHS.rowAudit} line ${index + 1}`)
  );
  const judgeAudits = parseJsonl<unknown>(
    files[SEMANTIC_AUDIT_REQUIRED_PATHS.judgeAudit],
    SEMANTIC_AUDIT_REQUIRED_PATHS.judgeAudit
  ).map((judgeAudit, index) =>
    normalizeJudgeAudit(judgeAudit, `${SEMANTIC_AUDIT_REQUIRED_PATHS.judgeAudit} line ${index + 1}`)
  );
  const detailsByDialogue = new Map<string, typeof details>();
  const rowAuditByDialogue = new Map(rowAudits.map((rowAudit) => [rowAudit.dialogue_id, rowAudit]));

  for (const detail of details) {
    const existing = detailsByDialogue.get(detail.dialogue_id);
    if (existing) {
      existing.push(detail);
    } else {
      detailsByDialogue.set(detail.dialogue_id, [detail]);
    }
  }

  const dialogues = flatDataset.dialogues
    .filter((dialogue) => detailsByDialogue.has(dialogue.dialogue_id))
    .map((dialogue): SemanticAuditDialogue => {
      const goldEvents = dialogue.eventsBySource.gold ?? [];
      const predEvents = dialogue.eventsBySource.lora ?? [];
      const baseEvents = dialogue.eventsBySource.base ?? [];
      const goldByIndex = indexEventsBySemanticIndex(goldEvents);
      const predByIndex = indexEventsBySemanticIndex(predEvents);
      const comparisons = (detailsByDialogue.get(dialogue.dialogue_id) ?? [])
        .sort((a, b) => a.event_index - b.event_index)
        .map((detail): SemanticEventComparison => ({
          ...detail,
          goldEvent:
            detail.gold_event_index == null ? null : goldByIndex.get(detail.gold_event_index) ?? null,
          predEvent:
            detail.pred_event_index == null ? null : predByIndex.get(detail.pred_event_index) ?? null,
          eventJudge: eventJudgeFor(
            judgeAudits,
            detail.dialogue_id,
            detail.gold_event_index,
            detail.pred_event_index
          ),
          fieldJudges: fieldJudgesFor(
            judgeAudits,
            detail.dialogue_id,
            detail.gold_event_index,
            detail.pred_event_index
          )
        }));
      const rowAudit = rowAuditByDialogue.get(dialogue.dialogue_id) ?? null;
      const unmatchedGold = comparisons.filter(
        (comparison) => comparison.match_status === "unmatched_gold"
      ).length;
      const unmatchedPred = comparisons.filter(
        (comparison) => comparison.match_status === "unmatched_pred"
      ).length;
      const matched = comparisons.filter((comparison) => comparison.match_status === "matched").length;

      return {
        dialogue_id: dialogue.dialogue_id,
        outcome: dialogue.outcome,
        typedScores: dialogue.typedScores,
        goldEvents,
        predEvents,
        baseEvents,
        comparisons,
        rowAudit,
        totalEvents: comparisons.length,
        unmatchedGold,
        unmatchedPred,
        matched,
        averageWeightedF1: averageWeightedF1(comparisons),
        hasLowQualityAlignment: rowAudit?.low_quality_alignment ?? false
      };
    })
    .sort(compareDialoguesByPriority);

  return {
    artifact,
    artifactId,
    importSource,
    runId: stringOrNull(manifest.run_id),
    targetSource: "lora",
    summary,
    dialogues,
    warnings:
      dialogues.length === 0
        ? ["Semantic audit archive did not contain any dialogues with semantic details."]
        : []
  };
}

export async function loadSemanticEventAuditZip(file: File): Promise<SemanticEventAuditDataset> {
  assertArchiveSize(file);

  const zip = await JSZip.loadAsync(file);
  const paths = visibleZipPaths(zip);
  const resolvedLayout = resolveZipLayout(paths);
  const files: ArtifactFiles = {};

  for (const key of requiredPathKeys) {
    files[SEMANTIC_AUDIT_REQUIRED_PATHS[key]] = await readZipText(
      zip,
      resolvedLayout.required[key]
    );
  }

  const manifestPath = resolvedLayout.optional.manifest;
  if (zip.file(manifestPath)) {
    files[optionalPaths.manifest] = await readZipText(zip, manifestPath);
  }

  return buildDataset({
    artifact: file.name,
    artifactId: `zip:${file.name}:${file.size}:${file.lastModified}`,
    importSource: {
      kind: "zip",
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified
    },
    files
  });
}

function parseGitHubDirectoryUrl(directoryUrl: string) {
  let url: URL;

  try {
    url = new URL(directoryUrl.trim());
  } catch {
    throw new Error("GitHub URL must be https://github.com/owner/repo/tree/ref/path");
  }

  if (url.hostname !== "github.com") {
    throw new Error("GitHub URL must be https://github.com/owner/repo/tree/ref/path");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 5 || parts[2] !== "tree") {
    throw new Error("GitHub URL must be https://github.com/owner/repo/tree/ref/path");
  }

  return {
    owner: parts[0],
    repo: parts[1],
    ref: parts[3],
    path: parts.slice(4).join("/")
  };
}

function decodeBase64Text(content: string): string {
  const compact = content.replace(/\s/g, "");
  const binary = atob(compact);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

class GitHubMissingFileError extends Error {}

function githubContentsUrl(
  source: ReturnType<typeof parseGitHubDirectoryUrl>,
  path?: string
): string {
  const fullPath = [source.path, path].filter(Boolean).join("/");

  return `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encodeURIComponent(
    fullPath
  ).replace(/%2F/g, "/")}?ref=${encodeURIComponent(source.ref)}`;
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json"
  };
}

async function assertGitHubDirectoryReadable({
  source,
  token
}: {
  source: ReturnType<typeof parseGitHubDirectoryUrl>;
  token: string;
}): Promise<void> {
  const response = await fetch(githubContentsUrl(source), {
    headers: githubHeaders(token)
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "GitHub directory is not readable: HTTP 404. Check owner, repo, branch, path, and whether the token can read this repository."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `GitHub token could not read the directory: HTTP ${response.status}. Check repository access and token scopes.`
      );
    }

    throw new Error(`Could not read GitHub directory: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("GitHub URL must point to a directory, not a file.");
  }
}

async function readGitHubContentFile({
  source,
  token,
  path
}: {
  source: ReturnType<typeof parseGitHubDirectoryUrl>;
  token: string;
  path: string;
}): Promise<string> {
  const response = await fetch(githubContentsUrl(source, path), {
    headers: githubHeaders(token)
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubMissingFileError(path);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `GitHub token could not read ${path}: HTTP ${response.status}. Check repository access and token scopes.`
      );
    }

    throw new Error(`Could not read ${path} from GitHub: HTTP ${response.status}`);
  }

  const payload = asRecord(await response.json(), `GitHub response for ${path}`);
  if (payload.type !== "file" || typeof payload.content !== "string") {
    throw new GitHubMissingFileError(path);
  }

  return decodeBase64Text(payload.content);
}

async function readGitHubLayout({
  source,
  token,
  layout
}: {
  source: ReturnType<typeof parseGitHubDirectoryUrl>;
  token: string;
  layout: SemanticAuditPathLayout;
}): Promise<ArtifactFiles> {
  const files: ArtifactFiles = {};

  for (const key of requiredPathKeys) {
    files[SEMANTIC_AUDIT_REQUIRED_PATHS[key]] = await readGitHubContentFile({
      source,
      token,
      path: layout.required[key]
    });
  }

  try {
    files[optionalPaths.manifest] = await readGitHubContentFile({
      source,
      token,
      path: layout.optional.manifest
    });
  } catch (error) {
    if (!(error instanceof GitHubMissingFileError)) {
      throw error;
    }
  }

  return files;
}

export async function loadSemanticEventAuditFromGitHub({
  token,
  directoryUrl
}: {
  token: string;
  directoryUrl: string;
}): Promise<SemanticEventAuditDataset> {
  if (!token.trim()) {
    throw new Error("GitHub token is required.");
  }

  const trimmedToken = token.trim();
  const source = parseGitHubDirectoryUrl(directoryUrl);
  let missingPath: string | null = null;

  await assertGitHubDirectoryReadable({ source, token: trimmedToken });

  for (const layout of semanticAuditPathLayouts) {
    try {
      const files = await readGitHubLayout({ source, token: trimmedToken, layout });

      return buildDataset({
        artifact: `${source.owner}/${source.repo}/${source.path}`,
        artifactId: `github:${source.owner}/${source.repo}@${source.ref}:${source.path}`,
        importSource: {
          kind: "github",
          ...source
        },
        files
      });
    } catch (error) {
      if (error instanceof GitHubMissingFileError) {
        missingPath = error.message;
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `GitHub directory does not match a semantic audit layout. Expected fixed semantic files under README.md or event-extraction/README.md. First missing file: ${
      missingPath ?? "README.md"
    }`
  );
}
