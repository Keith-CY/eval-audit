import { describe, expect, it } from "vitest";
import {
  buildGoldTopicNoteExports,
  loadGoldTopicDataset,
  parseGoldTopicDatasetText
} from "./loadGoldTopicDataset";

function makeGoldTopicFile(lines: unknown[], name = "gold-topics.jsonl"): File {
  return new File([lines.map((line) => JSON.stringify(line)).join("\n") + "\n"], name, {
    type: "application/jsonl"
  });
}

const baseCase = {
  allowed_duplicate_message_ids: [],
  allowed_fallback_reasons: [],
  allowed_unassigned_message_ids: [],
  case_weight: 1,
  expected_topic_count_range: [1, 1],
  forbidden_unassigned_message_ids: ["msg-1", "msg-2"],
  gold_version: "draft",
  notes: ["generated"],
  slices: ["first10"],
  source_conversation_id: "conv-1",
  source_dialogue_id: "dlg-1"
};

describe("loadGoldTopicDataset", () => {
  it("parses gold topic cases with derived message coverage and attention ordering", async () => {
    const dataset = await loadGoldTopicDataset(
      makeGoldTopicFile([
        {
          ...baseCase,
          gold_case_id: "simple-case",
          messages: [
            {
              message_id: "msg-1",
              sender: "A",
              text: "First simple message",
              timestamp: "2024-10-05T09:00:00"
            },
            {
              message_id: "msg-2",
              sender: "B",
              text: "Second simple message",
              timestamp: "2024-10-05T09:01:00"
            }
          ],
          gold_topics: [
            {
              allowed_multi_topic_message_ids: [],
              boundary_mode: "strict",
              criticality: "normal",
              description: "Simple topic",
              gold_topic_id: "topic-1",
              label: "Simple",
              may_merge_with: [],
              may_split_into: [],
              optional_bridge_message_ids: [],
              required_message_ids: ["msg-1"],
              topic_weight: 1
            }
          ]
        },
        {
          ...baseCase,
          allowed_fallback_reasons: ["empty_conversation"],
          allowed_unassigned_message_ids: ["msg-4"],
          expected_skip_or_fallback_reasons: ["empty_conversation"],
          expected_topic_count_range: [2, 2],
          forbidden_unassigned_message_ids: ["msg-3"],
          gold_case_id: "warning-case",
          source_dialogue_id: "dlg-2",
          messages: [
            {
              message_id: "msg-3",
              sender: "C",
              text: "Complex message",
              timestamp: "2024-10-06T09:00:00"
            },
            {
              message_id: "msg-4",
              sender: "D",
              text: "Allowed unassigned message",
              timestamp: "2024-10-06T09:01:00"
            }
          ],
          gold_topics: [
            {
              allowed_multi_topic_message_ids: [],
              boundary_mode: "strict",
              criticality: "normal",
              description: "Complex topic one",
              gold_topic_id: "topic-a",
              label: "Complex A",
              may_merge_with: [],
              may_split_into: [],
              optional_bridge_message_ids: [],
              required_message_ids: ["msg-3", "missing-msg"],
              topic_weight: 1
            },
            {
              allowed_multi_topic_message_ids: [],
              boundary_mode: "strict",
              criticality: "normal",
              description: "Complex topic two",
              gold_topic_id: "topic-b",
              label: "Complex B",
              may_merge_with: [],
              may_split_into: [],
              optional_bridge_message_ids: [],
              required_message_ids: ["msg-3"],
              topic_weight: 1
            }
          ]
        }
      ])
    );

    expect(dataset.artifact).toBe("gold-topics.jsonl");
    expect(dataset.summary).toMatchObject({
      totalCases: 2,
      totalMessages: 4,
      totalTopics: 3,
      casesWithAllowedUnassigned: 1,
      casesWithFallback: 1,
      casesWithWarnings: 1
    });
    expect(dataset.cases.map((goldCase) => goldCase.gold_case_id)).toEqual([
      "warning-case",
      "simple-case"
    ]);
    expect(dataset.cases[0].warnings).toEqual([
      {
        code: "missing_message_reference",
        message: "Topic topic-a references missing message missing-msg"
      }
    ]);
    expect(dataset.cases[0].messages[0]).toMatchObject({
      message_id: "msg-3",
      requiredTopicIds: ["topic-a", "topic-b"],
      isForbiddenUnassigned: true,
      isAllowedUnassigned: false
    });
    expect(dataset.cases[0].messages[1]).toMatchObject({
      message_id: "msg-4",
      requiredTopicIds: [],
      isForbiddenUnassigned: false,
      isAllowedUnassigned: true
    });
    expect(dataset.warnings).toHaveLength(1);
  });

  it("reports the source line for malformed rows", () => {
    expect(() =>
      parseGoldTopicDatasetText(
        `${JSON.stringify({ gold_case_id: "ok", messages: [], gold_topics: [] })}\n{"gold_case_id":4}\n`,
        "bad-gold.jsonl",
        "bad-gold.jsonl"
      )
    ).toThrow("bad-gold.jsonl line 2");
  });

  it("builds JSONL-ready note exports for case and message notes", () => {
    const exports = buildGoldTopicNoteExports({
      artifact: "gold-topics.jsonl",
      notes: {
        "case:gpt55-draft-001": "Case note",
        "message:gpt55-draft-001:msg-1": "Message note",
        "message:gpt55-draft-001:msg-2": "   "
      },
      casesById: {
        "gpt55-draft-001": {
          source_dialogue_id: "dlg-1",
          messages: new Set(["msg-1", "msg-2"])
        }
      },
      updatedAt: "2026-06-09T00:00:00.000Z"
    });

    expect(exports).toEqual([
      {
        artifact: "gold-topics.jsonl",
        gold_case_id: "gpt55-draft-001",
        source_dialogue_id: "dlg-1",
        scope: "case",
        message_id: null,
        note: "Case note",
        updated_at: "2026-06-09T00:00:00.000Z"
      },
      {
        artifact: "gold-topics.jsonl",
        gold_case_id: "gpt55-draft-001",
        source_dialogue_id: "dlg-1",
        scope: "message",
        message_id: "msg-1",
        note: "Message note",
        updated_at: "2026-06-09T00:00:00.000Z"
      }
    ]);
  });
});
