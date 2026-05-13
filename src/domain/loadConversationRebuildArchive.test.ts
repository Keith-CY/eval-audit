import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  CONVERSATION_REBUILD_ARCHIVE_LIMITS,
  loadConversationRebuildArchive
} from "./loadConversationRebuildArchive";

async function makeZip(files: Record<string, string>, name = "rebuild.zip"): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name, { type: "application/zip" });
}

function rebuildDialogues() {
  return [
    {
      schema_version: 1,
      dataset_record_type: "source_topic",
      dialogue_id: "dlg-topic-a",
      source_dialogue_id: "dlg-source-1",
      source_topic_dialogue_id: "dlg-topic-a",
      source_topic_id: "topic-1",
      source_topic_label: "Gift refusal",
      generation_strategy: "topic_rebuild",
      generation_mode: "topic_rebuild",
      source_dataset: "thu-coai/lccc:large",
      source_row_index: 42,
      input: {
        dialogue: [
          { message_id: "m1", sender: "speaker_1", text: "不用 不用 ， 心意 收到 了" },
          { message_id: "m2", sender: "speaker_2", text: "贴身 戴 的 亲" }
        ]
      },
      lineage: {
        source_dialogue_id: "dlg-source-1",
        source_topic_dialogue_id: "dlg-topic-a",
        topic_rebuild: {
          topic_id: "topic-1",
          topic_label: "Gift refusal",
          topic_description: "A short exchange about declining a wearable gift.",
          source_dialogue_id: "dlg-source-1",
          source_conversation_id: "conv-source-1",
          topic_rebuild_method: "llm_topic_membership"
        }
      }
    },
    {
      schema_version: 1,
      dataset_record_type: "source_topic",
      dialogue_id: "dlg-topic-b",
      source_dialogue_id: "dlg-source-1",
      source_topic_dialogue_id: "dlg-topic-b",
      source_topic_id: "topic-2",
      source_topic_label: "Weekend plan",
      generation_strategy: "topic_rebuild",
      generation_mode: "topic_rebuild",
      source_dataset: "thu-coai/lccc:large",
      source_row_index: 42,
      input: {
        dialogue: [
          { message_id: "m3", sender: "speaker_1", text: "周日 去 博物馆 吗" },
          { message_id: "m4", sender: "speaker_2", text: "可以 ， 再 看 话剧" },
          { message_id: "m5", sender: "speaker_1", text: "那 说 定 了" }
        ]
      },
      lineage: {
        source_dialogue_id: "dlg-source-1",
        source_topic_dialogue_id: "dlg-topic-b",
        topic_rebuild: {
          topic_id: "topic-2",
          topic_label: "Weekend plan",
          topic_description: "A plan to meet on Sunday.",
          source_dialogue_id: "dlg-source-1",
          source_conversation_id: "conv-source-1",
          topic_rebuild_method: "llm_topic_membership"
        }
      }
    },
    {
      schema_version: 1,
      dataset_record_type: "source_topic",
      dialogue_id: "dlg-topic-c",
      source_dialogue_id: "dlg-source-2",
      source_topic_dialogue_id: "dlg-topic-c",
      source_topic_id: "topic-1",
      source_topic_label: "Good night",
      generation_strategy: "topic_rebuild",
      generation_mode: "topic_rebuild",
      source_dataset: "thu-coai/lccc:large",
      source_row_index: 84,
      input: {
        dialogue: [{ message_id: "m6", sender: "speaker_1", text: "晚安 ， 早点 睡" }]
      },
      lineage: {
        source_dialogue_id: "dlg-source-2",
        source_topic_dialogue_id: "dlg-topic-c",
        topic_rebuild: {
          topic_id: "topic-1",
          topic_label: "Good night",
          topic_description: "A short good-night exchange.",
          source_dialogue_id: "dlg-source-2",
          source_conversation_id: "conv-source-2",
          topic_rebuild_method: "llm_topic_membership"
        }
      }
    }
  ];
}

function rebuildReport() {
  return {
    schema_version: 1,
    inputs: {
      lccc_hf_repo_id: "thu-coai/lccc",
      lccc_config_name: "large",
      lccc_min_turns: 10
    },
    run: {
      seed: 20260512,
      llm_provider: "openai",
      llm_model_id: "gpt-5.5",
      drop_full_dialogue_rebuilds: true
    },
    datasets: [
      {
        label: "thu-coai/lccc:large",
        output_topic_dialogues: 3,
        source_dialogues_processed: 2,
        dropped_full_dialogue_rebuilds: 1
      }
    ],
    counts: {
      total: 3,
      by_dataset: { "thu-coai/lccc:large": 3 },
      by_strategy: { topic_rebuild: 3 },
      duplicate_dialogue_id_count: 0
    },
    turn_counts: {
      min: 1,
      max: 3,
      average: 2
    }
  };
}

describe("loadConversationRebuildArchive", () => {
  it("loads rebuilt dialogues and groups relationships by source dialogue", async () => {
    const archive = await loadConversationRebuildArchive(
      await makeZip({
        "final_lccc_large_min10_topic_rebuild_dialogues.json": JSON.stringify(rebuildDialogues()),
        "final_lccc_large_min10_topic_rebuild_dialogues_report.json": JSON.stringify(
          rebuildReport()
        )
      })
    );

    expect(archive.fileName).toBe("rebuild.zip");
    expect(archive.totals).toMatchObject({
      rebuiltDialogues: 3,
      sourceDialogues: 2,
      sourceTopics: 2,
      datasets: 1,
      droppedFullDialogueRebuilds: 1
    });
    expect(archive.totals.averageTurns).toBe(2);
    expect(archive.report?.counts?.total).toBe(3);
    expect(archive.sourceGroups).toHaveLength(2);
    expect(archive.sourceGroups[0]).toMatchObject({
      sourceDialogueId: "dlg-source-1",
      sourceConversationId: "conv-source-1",
      rebuildCount: 2,
      topicCount: 2
    });
    expect(archive.sourceGroups[0].relations.map((relation) => relation.sourceTopicLabel)).toEqual([
      "Gift refusal",
      "Weekend plan"
    ]);
    expect(archive.sourceGroups[0].relations[0]).toMatchObject({
      dialogueId: "dlg-topic-a",
      sourceTopicId: "topic-1",
      turnCount: 2,
      preview: "speaker_1: 不用 不用 ， 心意 收到 了"
    });
    expect(archive.topicSummaries.map((topic) => [topic.sourceTopicId, topic.rebuildCount])).toEqual([
      ["topic-1", 2],
      ["topic-2", 1]
    ]);
  });

  it("loads an archive without a report and derives totals from dialogue records", async () => {
    const archive = await loadConversationRebuildArchive(
      await makeZip({
        "nested/rebuild_dialogues.json": JSON.stringify(rebuildDialogues())
      })
    );

    expect(archive.report).toBeNull();
    expect(archive.totals.rebuiltDialogues).toBe(3);
    expect(archive.totals.sourceDialogues).toBe(2);
    expect(archive.warnings).toEqual(["No rebuild report JSON was found."]);
  });

  it("throws a readable error when the dialogues JSON is missing", async () => {
    await expect(
      loadConversationRebuildArchive(
        await makeZip({
          "final_lccc_large_min10_topic_rebuild_dialogues_report.json": JSON.stringify(
            rebuildReport()
          )
        })
      )
    ).rejects.toThrow("Missing rebuilt dialogues JSON");
  });

  it("rejects oversized zip files before parsing", async () => {
    const oversizedFile = {
      size: CONVERSATION_REBUILD_ARCHIVE_LIMITS.maxZipBytes + 1
    } as File;

    await expect(loadConversationRebuildArchive(oversizedFile)).rejects.toThrow(
      "Conversation rebuild archive is too large"
    );
  });
});
