import { useMemo, useState } from "react";
import { stringifyJsonl } from "../domain/jsonl";
import { buildGoldTopicNoteExports } from "../domain/loadGoldTopicDataset";
import type { GoldTopicCase, GoldTopicDataset, GoldTopicMessage } from "../domain/types";

interface GoldTopicDatasetWorkbenchProps {
  dataset: GoldTopicDataset;
}

type CaseFilter = "all" | "warnings" | "allowed-unassigned" | "fallback" | "notes";

function fixed(value: number): string {
  return value.toFixed(1);
}

function caseNoteKey(goldCaseId: string): string {
  return `case:${goldCaseId}`;
}

function messageNoteKey(goldCaseId: string, messageId: string): string {
  return `message:${goldCaseId}:${messageId}`;
}

function noteCount(notes: Record<string, string>): number {
  return Object.values(notes).filter((note) => note.trim().length > 0).length;
}

function fallbackCount(goldCase: GoldTopicCase): number {
  return (
    goldCase.allowed_fallback_reasons.length +
    goldCase.expected_skip_or_fallback_reasons.length
  );
}

function unassignedStatus(message: GoldTopicMessage): string {
  if (message.isAllowedUnassigned) {
    return "allowed unassigned";
  }

  if (message.isForbiddenUnassigned) {
    return "blocked unassigned";
  }

  return "unassigned neutral";
}

function updateNote(
  setNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void,
  key: string,
  value: string
) {
  setNotes((current) => ({ ...current, [key]: value }));
}

export function GoldTopicDatasetWorkbench({ dataset }: GoldTopicDatasetWorkbenchProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CaseFilter>("all");
  const [activeCaseId, setActiveCaseId] = useState(dataset.cases[0]?.gold_case_id ?? null);
  const [activeMessageId, setActiveMessageId] = useState(dataset.cases[0]?.messages[0]?.message_id ?? null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const currentNoteCount = noteCount(notes);
  const casesById = useMemo(
    () =>
      Object.fromEntries(
        dataset.cases.map((goldCase) => [
          goldCase.gold_case_id,
          {
            source_dialogue_id: goldCase.source_dialogue_id,
            messages: new Set(goldCase.messages.map((message) => message.message_id))
          }
        ])
      ),
    [dataset.cases]
  );
  const filteredCases = useMemo(
    () =>
      dataset.cases.filter((goldCase) => {
        const matchesSearch =
          goldCase.gold_case_id.toLowerCase().includes(search.toLowerCase()) ||
          (goldCase.source_dialogue_id ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter === "warnings" && goldCase.warnings.length > 0) ||
          (filter === "allowed-unassigned" &&
            goldCase.allowed_unassigned_message_ids.length > 0) ||
          (filter === "fallback" && fallbackCount(goldCase) > 0) ||
          (filter === "notes" &&
            Object.keys(notes).some((key) => key.includes(`:${goldCase.gold_case_id}`)));

        return matchesSearch && matchesFilter;
      }),
    [dataset.cases, filter, notes, search]
  );
  const activeCase =
    filteredCases.find((goldCase) => goldCase.gold_case_id === activeCaseId) ??
    filteredCases[0] ??
    null;
  const activeMessage =
    activeCase?.messages.find((message) => message.message_id === activeMessageId) ??
    activeCase?.messages[0] ??
    null;
  const requiredTopics = activeCase
    ? activeCase.topics.filter((topic) => activeMessage?.requiredTopicIds.includes(topic.gold_topic_id))
    : [];
  const caseNote = activeCase ? notes[caseNoteKey(activeCase.gold_case_id)] ?? "" : "";
  const messageNote =
    activeCase && activeMessage
      ? notes[messageNoteKey(activeCase.gold_case_id, activeMessage.message_id)] ?? ""
      : "";

  function selectCase(goldCase: GoldTopicCase) {
    setActiveCaseId(goldCase.gold_case_id);
    setActiveMessageId(goldCase.messages[0]?.message_id ?? null);
  }

  function exportNotes() {
    const records = buildGoldTopicNoteExports({
      artifact: dataset.artifact,
      notes,
      casesById,
      updatedAt: new Date().toISOString()
    });
    const blob = new Blob([stringifyJsonl(records)], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset.artifact.replace(/\.[^.]+$/, "")}.notes.jsonl`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearNotes() {
    if (window.confirm("Clear all notes for this dataset?")) {
      setNotes({});
    }
  }

  return (
    <section className="gold-topic-workbench" aria-label="Gold topic dataset workbench">
      <div className="flat-summary-band gold-topic-summary-band">
        <div className="metric-card">
          <p className="eyebrow">Artifact</p>
          <h1>{dataset.artifact}</h1>
          <small>{dataset.summary.totalCases} cases</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Messages</p>
          <strong>{dataset.summary.totalMessages}</strong>
          <small>{fixed(dataset.summary.averageMessagesPerCase)} per case</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Topics</p>
          <strong>{dataset.summary.totalTopics}</strong>
          <small>{fixed(dataset.summary.averageTopicsPerCase)} per case</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Allowed unassigned</p>
          <strong>{dataset.summary.casesWithAllowedUnassigned}</strong>
          <small>cases</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Fallback</p>
          <strong>{dataset.summary.casesWithFallback}</strong>
          <small>cases</small>
        </div>
        <div className="metric-card" aria-label={`${currentNoteCount} notes`}>
          <p className="eyebrow">Notes</p>
          <strong>{currentNoteCount}</strong>
          <small>{currentNoteCount === 1 ? "note" : "notes"}</small>
        </div>
      </div>
      {dataset.warnings.length > 0 ? (
        <div className="warning-strip" role="status" aria-label="Gold topic dataset warnings">
          {dataset.summary.casesWithWarnings} case{dataset.summary.casesWithWarnings === 1 ? "" : "s"} with warnings.{" "}
          {dataset.warnings[0].message}
        </div>
      ) : null}
      <div className="gold-topic-toolbar">
        <button type="button" disabled={currentNoteCount === 0} onClick={exportNotes}>
          Export notes JSONL
        </button>
        <button type="button" disabled={currentNoteCount === 0} onClick={clearNotes}>
          Clear notes
        </button>
      </div>
      <div className="gold-topic-grid">
        <aside className="dialogue-sidebar" aria-label="Gold topic case list">
          <div className="filters">
            <input
              aria-label="Search gold topic cases"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case or dialogue"
            />
            <select
              aria-label="Gold topic case filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as CaseFilter)}
            >
              <option value="all">All cases</option>
              <option value="warnings">Has warnings</option>
              <option value="allowed-unassigned">Allowed unassigned</option>
              <option value="fallback">Fallback</option>
              <option value="notes">Has notes</option>
            </select>
          </div>
          <div className="dialogue-list">
            {filteredCases.length === 0 ? (
              <p className="empty-list">No matching cases</p>
            ) : (
              filteredCases.map((goldCase) => (
                <button
                  key={goldCase.gold_case_id}
                  aria-current={
                    goldCase.gold_case_id === activeCase?.gold_case_id ? "true" : undefined
                  }
                  className={
                    goldCase.gold_case_id === activeCase?.gold_case_id
                      ? "dialogue-list-item active"
                      : "dialogue-list-item"
                  }
                  type="button"
                  onClick={() => selectCase(goldCase)}
                >
                  <span>Case {goldCase.gold_case_id}</span>
                  <small>
                    {goldCase.messages.length} messages / {goldCase.topics.length} topics
                  </small>
                  {goldCase.attentionReasons.length > 0 ? (
                    <small>{goldCase.attentionReasons.join(", ")}</small>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="gold-topic-matrix-pane" aria-label="Topic coverage matrix">
          {activeCase ? (
            <div className="gold-topic-matrix-scroll">
              <table className="gold-topic-matrix">
                <thead>
                  <tr>
                    <th scope="col">Message</th>
                    {activeCase.topics.map((topic) => (
                      <th key={topic.gold_topic_id} scope="col">
                        <span>{topic.label}</span>
                        <small>{topic.gold_topic_id}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeCase.messages.map((message, index) => (
                    <tr
                      key={message.message_id}
                      className={
                        message.message_id === activeMessage?.message_id ? "selected" : undefined
                      }
                    >
                      <th scope="row">
                        <button
                          type="button"
                          onClick={() => setActiveMessageId(message.message_id)}
                          aria-label={`Select message ${message.message_id}`}
                        >
                          <strong>#{index + 1}</strong>
                          <span>{message.sender || "-"}</span>
                          <small>{message.text}</small>
                          <em>{unassignedStatus(message)}</em>
                        </button>
                      </th>
                      {activeCase.topics.map((topic) => {
                        const isRequired = message.requiredTopicIds.includes(topic.gold_topic_id);

                        return (
                          <td key={`${message.message_id}-${topic.gold_topic_id}`}>
                            {isRequired ? (
                              <span
                                aria-label={`${message.message_id} required in ${topic.label}`}
                                className="coverage-dot"
                              />
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">Current case</p>
              <h2>No cases match the current filters</h2>
            </div>
          )}
        </section>
        <aside className="detail-pane gold-topic-detail" aria-label="Gold topic message detail">
          {activeCase && activeMessage ? (
            <>
              <div className="detail-header">
                <div className="detail-title">
                  <p className="eyebrow">Current case</p>
                  <h2>{activeCase.gold_case_id}</h2>
                  <p>{activeCase.source_dialogue_id ?? "No source dialogue id"}</p>
                </div>
              </div>
              {activeCase.warnings.length > 0 ? (
                <div className="gold-topic-warning-list">
                  {activeCase.warnings.map((caseWarning, index) => (
                    <p key={`${caseWarning.code}-${index}`}>{caseWarning.message}</p>
                  ))}
                </div>
              ) : null}
              <label className="semantic-feedback">
                <span>Case note</span>
                <textarea
                  aria-label="Case note"
                  rows={4}
                  value={caseNote}
                  onChange={(event) =>
                    updateNote(setNotes, caseNoteKey(activeCase.gold_case_id), event.target.value)
                  }
                />
              </label>
              <div className="gold-topic-message-card">
                <p className="eyebrow">Selected message</p>
                <h3>{activeMessage.message_id}</h3>
                <small>
                  {activeMessage.sender || "-"} / {activeMessage.timestamp ?? "-"}
                </small>
                <p>{activeMessage.text}</p>
                <span className="gold-topic-status">{unassignedStatus(activeMessage)}</span>
              </div>
              <div className="gold-topic-chip-list" aria-label="Required topics">
                {requiredTopics.length === 0 ? (
                  <p className="empty-list">No required topics</p>
                ) : (
                  requiredTopics.map((topic) => (
                    <span className="gold-topic-chip" key={topic.gold_topic_id}>
                      <strong>{topic.label}</strong>
                      <small>{topic.gold_topic_id}</small>
                    </span>
                  ))
                )}
              </div>
              <label className="semantic-feedback">
                <span>Message note</span>
                <textarea
                  aria-label="Message note"
                  rows={4}
                  value={messageNote}
                  onChange={(event) =>
                    updateNote(
                      setNotes,
                      messageNoteKey(activeCase.gold_case_id, activeMessage.message_id),
                      event.target.value
                    )
                  }
                />
              </label>
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">Selected message</p>
              <h2>No message selected</h2>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
