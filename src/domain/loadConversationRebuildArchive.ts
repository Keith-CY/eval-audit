import JSZip from "jszip";

export const CONVERSATION_REBUILD_ARCHIVE_LIMITS = {
  maxZipBytes: 100 * 1024 * 1024,
  maxEntries: 50,
  maxTextChars: 80 * 1024 * 1024
};

export interface ConversationRebuildReport {
  schema_version?: number;
  inputs?: Record<string, unknown>;
  run?: Record<string, unknown>;
  datasets?: Array<Record<string, unknown>>;
  counts?: {
    total?: number;
    by_dataset?: Record<string, number>;
    by_type?: Record<string, number>;
    by_strategy?: Record<string, number>;
    duplicate_dialogue_id_count?: number;
  };
  turn_counts?: {
    min?: number;
    max?: number;
    average?: number;
  };
}

export interface ConversationTurn {
  messageId: string | null;
  sender: string;
  text: string;
}

export interface RebuildRelation {
  dialogueId: string;
  sourceDialogueId: string;
  sourceConversationId: string | null;
  sourceTopicDialogueId: string | null;
  sourceTopicId: string;
  sourceTopicLabel: string;
  topicDescription: string | null;
  rebuildMethod: string | null;
  generationStrategy: string | null;
  generationMode: string | null;
  sourceDataset: string | null;
  sourceRowIndex: number | null;
  turnCount: number;
  preview: string;
  turns: ConversationTurn[];
}

export interface SourceDialogueGroup {
  sourceDialogueId: string;
  sourceConversationId: string | null;
  sourceDataset: string | null;
  sourceRowIndex: number | null;
  rebuildCount: number;
  topicCount: number;
  totalTurns: number;
  relations: RebuildRelation[];
}

export interface TopicSummary {
  sourceTopicId: string;
  sourceTopicLabel: string;
  rebuildCount: number;
  sourceDialogueCount: number;
}

export interface ConversationRebuildTotals {
  rebuiltDialogues: number;
  sourceDialogues: number;
  sourceTopics: number;
  datasets: number;
  minTurns: number | null;
  maxTurns: number | null;
  averageTurns: number | null;
  droppedFullDialogueRebuilds: number | null;
}

export interface ConversationRebuildArchive {
  fileName: string;
  title: string;
  report: ConversationRebuildReport | null;
  totals: ConversationRebuildTotals;
  sourceGroups: SourceDialogueGroup[];
  topicSummaries: TopicSummary[];
  warnings: string[];
}

interface RawRebuildDialogue {
  dialogue_id?: unknown;
  source_dialogue_id?: unknown;
  source_topic_dialogue_id?: unknown;
  source_topic_id?: unknown;
  source_topic_label?: unknown;
  generation_strategy?: unknown;
  generation_mode?: unknown;
  source_dataset?: unknown;
  source_row_index?: unknown;
  input?: {
    dialogue?: unknown;
  };
  lineage?: {
    source_dialogue_id?: unknown;
    source_topic_dialogue_id?: unknown;
    topic_rebuild?: {
      topic_id?: unknown;
      topic_label?: unknown;
      topic_description?: unknown;
      source_dialogue_id?: unknown;
      source_conversation_id?: unknown;
      topic_rebuild_method?: unknown;
    };
  };
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function isMacOsMetadata(path: string): boolean {
  return path.includes("__MACOSX/") || basename(path).startsWith("._");
}

function assertZipFileWithinLimits(file: File): void {
  if (file.size > CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxZipBytes) {
    throw new Error(
      `Conversation rebuild archive is too large. Maximum supported size is ${formatMegabytes(
        CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxZipBytes
      )}.`
    );
  }
}

function assertEntryCountWithinLimits(paths: string[]): void {
  if (paths.length > CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxEntries) {
    throw new Error(
      `Conversation rebuild archive contains too many files. Maximum supported entries is ${CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxEntries}.`
    );
  }
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Zip entry not found: ${path}`);
  }

  const text = await entry.async("text");
  if (text.length > CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxTextChars) {
    throw new Error(
      `${path} is too large after decompression. Maximum supported text size is ${formatMegabytes(
        CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxTextChars
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

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function findDialoguesPath(paths: string[]): string | null {
  return (
    paths
      .filter((path) => {
        const name = basename(path);
        return (
          !isMacOsMetadata(path) &&
          name.endsWith(".json") &&
          name.includes("dialogues") &&
          !name.includes("report")
        );
      })
      .sort((left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right))
      .at(0) ?? null
  );
}

function findReportPath(paths: string[]): string | null {
  return (
    paths
      .filter((path) => {
        const name = basename(path);
        return !isMacOsMetadata(path) && name.endsWith(".json") && name.includes("report");
      })
      .sort((left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right))
      .at(0) ?? null
  );
}

function normalizeTurns(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((turn, index) => {
    if (typeof turn === "string") {
      return [{ messageId: null, sender: `turn_${index + 1}`, text: turn }];
    }
    if (!turn || typeof turn !== "object") {
      return [];
    }
    const record = turn as Record<string, unknown>;
    const text = optionalString(record.text);
    if (!text) {
      return [];
    }
    return [
      {
        messageId: optionalString(record.message_id),
        sender: optionalString(record.sender) ?? `turn_${index + 1}`,
        text
      }
    ];
  });
}

function previewFromTurns(turns: ConversationTurn[]): string {
  const first = turns[0];
  if (!first) {
    return "";
  }
  return `${first.sender}: ${first.text}`.slice(0, 160);
}

function normalizeRelation(row: RawRebuildDialogue, index: number): RebuildRelation {
  const topicRebuild = row.lineage?.topic_rebuild;
  const turns = normalizeTurns(row.input?.dialogue);
  const sourceDialogueId =
    optionalString(row.source_dialogue_id) ??
    optionalString(row.lineage?.source_dialogue_id) ??
    optionalString(topicRebuild?.source_dialogue_id) ??
    `missing-source-${index + 1}`;
  const sourceTopicId =
    optionalString(row.source_topic_id) ?? optionalString(topicRebuild?.topic_id) ?? "unknown-topic";

  return {
    dialogueId: optionalString(row.dialogue_id) ?? `dialogue-${index + 1}`,
    sourceDialogueId,
    sourceConversationId: optionalString(topicRebuild?.source_conversation_id),
    sourceTopicDialogueId:
      optionalString(row.source_topic_dialogue_id) ??
      optionalString(row.lineage?.source_topic_dialogue_id),
    sourceTopicId,
    sourceTopicLabel:
      optionalString(row.source_topic_label) ?? optionalString(topicRebuild?.topic_label) ?? sourceTopicId,
    topicDescription: optionalString(topicRebuild?.topic_description),
    rebuildMethod: optionalString(topicRebuild?.topic_rebuild_method),
    generationStrategy: optionalString(row.generation_strategy),
    generationMode: optionalString(row.generation_mode),
    sourceDataset: optionalString(row.source_dataset),
    sourceRowIndex: optionalNumber(row.source_row_index),
    turnCount: turns.length,
    preview: previewFromTurns(turns),
    turns
  };
}

function buildSourceGroups(relations: RebuildRelation[]): SourceDialogueGroup[] {
  const groups = new Map<string, SourceDialogueGroup>();

  for (const relation of relations) {
    const group =
      groups.get(relation.sourceDialogueId) ??
      ({
        sourceDialogueId: relation.sourceDialogueId,
        sourceConversationId: relation.sourceConversationId,
        sourceDataset: relation.sourceDataset,
        sourceRowIndex: relation.sourceRowIndex,
        rebuildCount: 0,
        topicCount: 0,
        totalTurns: 0,
        relations: []
      } satisfies SourceDialogueGroup);

    group.rebuildCount += 1;
    group.totalTurns += relation.turnCount;
    group.relations.push(relation);
    if (!group.sourceConversationId && relation.sourceConversationId) {
      group.sourceConversationId = relation.sourceConversationId;
    }
    if (!group.sourceDataset && relation.sourceDataset) {
      group.sourceDataset = relation.sourceDataset;
    }
    if (group.sourceRowIndex === null && relation.sourceRowIndex !== null) {
      group.sourceRowIndex = relation.sourceRowIndex;
    }
    groups.set(relation.sourceDialogueId, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      topicCount: new Set(group.relations.map((relation) => relation.sourceTopicId)).size,
      relations: [...group.relations].sort((left, right) =>
        left.sourceTopicId.localeCompare(right.sourceTopicId, undefined, { numeric: true })
      )
    }))
    .sort(
      (left, right) =>
        right.rebuildCount - left.rebuildCount ||
        right.topicCount - left.topicCount ||
        left.sourceDialogueId.localeCompare(right.sourceDialogueId)
    );
}

function buildTopicSummaries(relations: RebuildRelation[]): TopicSummary[] {
  const summaries = new Map<
    string,
    { sourceTopicId: string; sourceTopicLabel: string; rebuildCount: number; sources: Set<string> }
  >();

  for (const relation of relations) {
    const summary =
      summaries.get(relation.sourceTopicId) ??
      ({
        sourceTopicId: relation.sourceTopicId,
        sourceTopicLabel: relation.sourceTopicLabel,
        rebuildCount: 0,
        sources: new Set<string>()
      });
    summary.rebuildCount += 1;
    summary.sources.add(relation.sourceDialogueId);
    summaries.set(relation.sourceTopicId, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      sourceTopicId: summary.sourceTopicId,
      sourceTopicLabel: summary.sourceTopicLabel,
      rebuildCount: summary.rebuildCount,
      sourceDialogueCount: summary.sources.size
    }))
    .sort(
      (left, right) =>
        right.rebuildCount - left.rebuildCount ||
        left.sourceTopicId.localeCompare(right.sourceTopicId, undefined, { numeric: true })
    );
}

function reportDroppedFullDialogueRebuilds(report: ConversationRebuildReport | null): number | null {
  const datasetValue = report?.datasets
    ?.map((dataset) => optionalNumber(dataset.dropped_full_dialogue_rebuilds))
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  return datasetValue ?? null;
}

function buildTotals(
  relations: RebuildRelation[],
  report: ConversationRebuildReport | null
): ConversationRebuildTotals {
  const turnCounts = relations.map((relation) => relation.turnCount);
  const datasetLabels = new Set(relations.flatMap((relation) => relation.sourceDataset ?? []));

  return {
    rebuiltDialogues: relations.length,
    sourceDialogues: new Set(relations.map((relation) => relation.sourceDialogueId)).size,
    sourceTopics: new Set(relations.map((relation) => relation.sourceTopicId)).size,
    datasets: datasetLabels.size || Object.keys(report?.counts?.by_dataset ?? {}).length,
    minTurns: optionalNumber(report?.turn_counts?.min) ?? (turnCounts.length ? Math.min(...turnCounts) : null),
    maxTurns: optionalNumber(report?.turn_counts?.max) ?? (turnCounts.length ? Math.max(...turnCounts) : null),
    averageTurns:
      optionalNumber(report?.turn_counts?.average) ??
      (turnCounts.length
        ? turnCounts.reduce((sum, value) => sum + value, 0) / turnCounts.length
        : null),
    droppedFullDialogueRebuilds: reportDroppedFullDialogueRebuilds(report)
  };
}

export async function loadConversationRebuildArchive(
  file: File
): Promise<ConversationRebuildArchive> {
  assertZipFileWithinLimits(file);

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const zipPaths = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  assertEntryCountWithinLimits(zipPaths);

  const dialoguesPath = findDialoguesPath(zipPaths);
  if (!dialoguesPath) {
    throw new Error("Missing rebuilt dialogues JSON.");
  }

  const reportPath = findReportPath(zipPaths);
  const rawDialogues = parseJson<unknown>(dialoguesPath, await readText(zip, dialoguesPath));
  if (!Array.isArray(rawDialogues)) {
    throw new Error(`${dialoguesPath}: expected a JSON array of rebuilt dialogues.`);
  }

  const report = reportPath
    ? parseJson<ConversationRebuildReport>(reportPath, await readText(zip, reportPath))
    : null;
  const warnings = report ? [] : ["No rebuild report JSON was found."];
  const relations = rawDialogues.map((row, index) =>
    normalizeRelation(row as RawRebuildDialogue, index)
  );
  const sourceGroups = buildSourceGroups(relations);

  return {
    fileName: file.name,
    title: basename(dialoguesPath).replace(/\.json$/, ""),
    report,
    totals: buildTotals(relations, report),
    sourceGroups,
    topicSummaries: buildTopicSummaries(relations),
    warnings
  };
}
