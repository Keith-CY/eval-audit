import { parseJsonl } from "./jsonl";
import type {
  GoldTopic,
  GoldTopicCase,
  GoldTopicDataset,
  GoldTopicMessage,
  GoldTopicNoteExport,
  GoldTopicWarning
} from "./types";

export const GOLD_TOPIC_DATASET_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024
};

interface GoldTopicCaseWithLine extends GoldTopicCase {
  lineNumber: number;
}

interface BuildGoldTopicNoteExportsInput {
  artifact: string;
  notes: Record<string, string>;
  casesById: Record<
    string,
    {
      source_dialogue_id: string | null;
      messages: Set<string>;
    }
  >;
  updatedAt: string;
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function assertFileWithinLimits(file: File): void {
  if (file.size > GOLD_TOPIC_DATASET_LIMITS.maxFileBytes) {
    throw new Error(
      `Gold topic dataset JSONL is too large. Maximum supported size is ${formatMegabytes(
        GOLD_TOPIC_DATASET_LIMITS.maxFileBytes
      )}.`
    );
  }
}

function asRecord(value: unknown, sourceName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${sourceName}: row must be an object`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, sourceName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${sourceName}: ${field} must be a non-empty string`);
  }

  return value;
}

function optionalString(value: unknown, field: string, sourceName: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${sourceName}: ${field} must be a string or null`);
  }

  return value;
}

function optionalNumber(value: unknown, field: string, sourceName: string): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${sourceName}: ${field} must be a finite number or null`);
  }

  return value;
}

function optionalStringArray(value: unknown, field: string, sourceName: string): string[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${sourceName}: ${field} must be an array of strings`);
  }

  return value;
}

function requiredArray(value: unknown, field: string, sourceName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${sourceName}: ${field} must be an array`);
  }

  return value;
}

function expectedTopicRange(
  value: unknown,
  field: string,
  sourceName: string
): [number, number] | null {
  if (value == null) {
    return null;
  }

  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    throw new Error(`${sourceName}: ${field} must be a two-number array or null`);
  }

  return [value[0], value[1]];
}

function normalizeMessage(rawMessage: unknown, sourceName: string): Omit<
  GoldTopicMessage,
  "requiredTopicIds" | "isForbiddenUnassigned" | "isAllowedUnassigned"
> {
  const record = asRecord(rawMessage, sourceName);

  return {
    message_id: requiredString(record.message_id, "message_id", sourceName),
    sender: optionalString(record.sender, "sender", sourceName) ?? "",
    text: requiredString(record.text, "text", sourceName),
    timestamp: optionalString(record.timestamp, "timestamp", sourceName)
  };
}

function normalizeTopic(rawTopic: unknown, sourceName: string): GoldTopic {
  const record = asRecord(rawTopic, sourceName);

  return {
    gold_topic_id: requiredString(record.gold_topic_id, "gold_topic_id", sourceName),
    label: requiredString(record.label, "label", sourceName),
    description: optionalString(record.description, "description", sourceName) ?? "",
    required_message_ids: optionalStringArray(
      record.required_message_ids,
      "required_message_ids",
      sourceName
    ),
    topic_weight: optionalNumber(record.topic_weight, "topic_weight", sourceName),
    boundary_mode: optionalString(record.boundary_mode, "boundary_mode", sourceName),
    criticality: optionalString(record.criticality, "criticality", sourceName),
    optional_bridge_message_ids: optionalStringArray(
      record.optional_bridge_message_ids,
      "optional_bridge_message_ids",
      sourceName
    ),
    allowed_multi_topic_message_ids: optionalStringArray(
      record.allowed_multi_topic_message_ids,
      "allowed_multi_topic_message_ids",
      sourceName
    ),
    may_merge_with: optionalStringArray(record.may_merge_with, "may_merge_with", sourceName),
    may_split_into: optionalStringArray(record.may_split_into, "may_split_into", sourceName)
  };
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicated.add(value);
    }
    seen.add(value);
  }

  return [...duplicated].sort((a, b) => a.localeCompare(b));
}

function warning(code: string, message: string): GoldTopicWarning {
  return { code, message };
}

function normalizeCase(rawCase: unknown, sourceName: string, lineNumber: number): GoldTopicCaseWithLine {
  const record = asRecord(rawCase, sourceName);
  const rawMessages = requiredArray(record.messages, "messages", sourceName);
  const rawTopics = requiredArray(record.gold_topics, "gold_topics", sourceName);
  const messagesWithoutCoverage = rawMessages.map((message, index) =>
    normalizeMessage(message, `${sourceName} message ${index + 1}`)
  );
  const topics = rawTopics.map((topic, index) =>
    normalizeTopic(topic, `${sourceName} topic ${index + 1}`)
  );
  const allowedUnassigned = optionalStringArray(
    record.allowed_unassigned_message_ids,
    "allowed_unassigned_message_ids",
    sourceName
  );
  const forbiddenUnassigned = optionalStringArray(
    record.forbidden_unassigned_message_ids,
    "forbidden_unassigned_message_ids",
    sourceName
  );
  const allowedFallback = optionalStringArray(
    record.allowed_fallback_reasons,
    "allowed_fallback_reasons",
    sourceName
  );
  const expectedSkipOrFallback = optionalStringArray(
    record.expected_skip_or_fallback_reasons,
    "expected_skip_or_fallback_reasons",
    sourceName
  );
  const caseWarnings: GoldTopicWarning[] = [];
  const messageIds = messagesWithoutCoverage.map((message) => message.message_id);
  const messageIdSet = new Set(messageIds);
  const requiredTopicIdsByMessage = new Map<string, string[]>();
  const expectedRange = expectedTopicRange(
    record.expected_topic_count_range,
    "expected_topic_count_range",
    sourceName
  );

  for (const topic of topics) {
    for (const messageId of topic.required_message_ids) {
      if (!messageIdSet.has(messageId)) {
        caseWarnings.push(
          warning(
            "missing_message_reference",
            `Topic ${topic.gold_topic_id} references missing message ${messageId}`
          )
        );
        continue;
      }

      const existing = requiredTopicIdsByMessage.get(messageId) ?? [];
      existing.push(topic.gold_topic_id);
      requiredTopicIdsByMessage.set(messageId, existing);
    }
  }

  if (expectedRange && (topics.length < expectedRange[0] || topics.length > expectedRange[1])) {
    caseWarnings.push(
      warning(
        "topic_count_range_mismatch",
        `Expected ${expectedRange[0]}-${expectedRange[1]} topics but found ${topics.length}`
      )
    );
  }

  for (const messageId of [...allowedUnassigned, ...forbiddenUnassigned]) {
    if (!messageIdSet.has(messageId)) {
      caseWarnings.push(warning("missing_unassigned_reference", `Unassigned rule references missing message ${messageId}`));
    }
  }

  for (const messageId of duplicateValues(messageIds)) {
    caseWarnings.push(warning("duplicate_message_id", `Message id ${messageId} appears more than once`));
  }

  for (const topicId of duplicateValues(topics.map((topic) => topic.gold_topic_id))) {
    caseWarnings.push(warning("duplicate_topic_id", `Topic id ${topicId} appears more than once`));
  }

  const allowedUnassignedSet = new Set(allowedUnassigned);
  const forbiddenUnassignedSet = new Set(forbiddenUnassigned);
  const messages: GoldTopicMessage[] = messagesWithoutCoverage.map((message) => ({
    ...message,
    requiredTopicIds: requiredTopicIdsByMessage.get(message.message_id) ?? [],
    isAllowedUnassigned: allowedUnassignedSet.has(message.message_id),
    isForbiddenUnassigned: forbiddenUnassignedSet.has(message.message_id)
  }));
  const requiredCoverage = topics.reduce(
    (total, topic) => total + topic.required_message_ids.length,
    0
  );
  const attentionReasons: string[] = [];
  let attentionScore = 0;

  if (caseWarnings.length > 0) {
    attentionScore += caseWarnings.length * 1000;
    attentionReasons.push(`${caseWarnings.length} warning${caseWarnings.length === 1 ? "" : "s"}`);
  }
  if (topics.length >= 8) {
    attentionScore += topics.length * 20;
    attentionReasons.push(`${topics.length} topics`);
  } else {
    attentionScore += topics.length * 5;
  }
  if (messages.length >= 30) {
    attentionScore += messages.length * 8;
    attentionReasons.push(`${messages.length} messages`);
  } else {
    attentionScore += messages.length * 2;
  }
  if (requiredCoverage >= messages.length * 2) {
    attentionScore += requiredCoverage;
    attentionReasons.push("dense coverage");
  }
  if (allowedUnassigned.length > 0) {
    attentionScore += allowedUnassigned.length * 50;
    attentionReasons.push("allowed unassigned");
  }
  if (allowedFallback.length > 0 || expectedSkipOrFallback.length > 0) {
    attentionScore += (allowedFallback.length + expectedSkipOrFallback.length) * 50;
    attentionReasons.push("fallback");
  }

  return {
    gold_case_id: requiredString(record.gold_case_id, "gold_case_id", sourceName),
    source_dialogue_id: optionalString(record.source_dialogue_id, "source_dialogue_id", sourceName),
    source_conversation_id: optionalString(
      record.source_conversation_id,
      "source_conversation_id",
      sourceName
    ),
    expected_topic_count_range: expectedRange,
    allowed_duplicate_message_ids: optionalStringArray(
      record.allowed_duplicate_message_ids,
      "allowed_duplicate_message_ids",
      sourceName
    ),
    allowed_fallback_reasons: allowedFallback,
    expected_skip_or_fallback_reasons: expectedSkipOrFallback,
    allowed_unassigned_message_ids: allowedUnassigned,
    forbidden_unassigned_message_ids: forbiddenUnassigned,
    notes: optionalStringArray(record.notes, "notes", sourceName),
    slices: optionalStringArray(record.slices, "slices", sourceName),
    gold_version: optionalString(record.gold_version, "gold_version", sourceName),
    case_weight: optionalNumber(record.case_weight, "case_weight", sourceName),
    messages,
    topics,
    warnings: caseWarnings,
    attentionScore,
    attentionReasons,
    lineNumber
  };
}

function publicCase(goldCase: GoldTopicCaseWithLine): GoldTopicCase {
  const { lineNumber: _lineNumber, ...caseWithoutLine } = goldCase;
  return caseWithoutLine;
}

export function parseGoldTopicDatasetText(
  text: string,
  sourceName: string,
  artifact: string
): GoldTopicDataset {
  const rawCases = parseJsonl<unknown>(text, sourceName);
  const cases = rawCases
    .map((rawCase, index) => normalizeCase(rawCase, `${sourceName} line ${index + 1}`, index + 1))
    .sort(
      (a, b) =>
        b.attentionScore - a.attentionScore ||
        a.gold_case_id.localeCompare(b.gold_case_id, undefined, { numeric: true }) ||
        a.lineNumber - b.lineNumber
    )
    .map(publicCase);
  const totalMessages = cases.reduce((total, goldCase) => total + goldCase.messages.length, 0);
  const totalTopics = cases.reduce((total, goldCase) => total + goldCase.topics.length, 0);
  const warnings = cases.flatMap((goldCase) => goldCase.warnings);

  return {
    artifact,
    cases,
    summary: {
      totalCases: cases.length,
      totalMessages,
      totalTopics,
      averageMessagesPerCase: cases.length > 0 ? totalMessages / cases.length : 0,
      averageTopicsPerCase: cases.length > 0 ? totalTopics / cases.length : 0,
      casesWithWarnings: cases.filter((goldCase) => goldCase.warnings.length > 0).length,
      casesWithAllowedUnassigned: cases.filter(
        (goldCase) => goldCase.allowed_unassigned_message_ids.length > 0
      ).length,
      casesWithFallback: cases.filter(
        (goldCase) =>
          goldCase.allowed_fallback_reasons.length > 0 ||
          goldCase.expected_skip_or_fallback_reasons.length > 0
      ).length
    },
    warnings
  };
}

export async function loadGoldTopicDataset(file: File): Promise<GoldTopicDataset> {
  assertFileWithinLimits(file);
  const text = await file.text();
  return parseGoldTopicDatasetText(text, file.name, file.name);
}

export function buildGoldTopicNoteExports({
  artifact,
  notes,
  casesById,
  updatedAt
}: BuildGoldTopicNoteExportsInput): GoldTopicNoteExport[] {
  const exports: GoldTopicNoteExport[] = [];

  for (const [key, rawNote] of Object.entries(notes)) {
    const note = rawNote.trim();
    if (!note) {
      continue;
    }

    const [scope, goldCaseId, ...rest] = key.split(":");
    const caseContext = casesById[goldCaseId];

    if (!caseContext || (scope !== "case" && scope !== "message")) {
      continue;
    }

    const messageId = scope === "message" ? rest.join(":") : null;

    if (scope === "message" && (!messageId || !caseContext.messages.has(messageId))) {
      continue;
    }

    exports.push({
      artifact,
      gold_case_id: goldCaseId,
      source_dialogue_id: caseContext.source_dialogue_id,
      scope,
      message_id: messageId,
      note,
      updated_at: updatedAt
    });
  }

  return exports.sort(
    (a, b) =>
      a.gold_case_id.localeCompare(b.gold_case_id, undefined, { numeric: true }) ||
      a.scope.localeCompare(b.scope) ||
      (a.message_id ?? "").localeCompare(b.message_id ?? "", undefined, { numeric: true })
  );
}
