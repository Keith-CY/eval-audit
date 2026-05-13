import { GitBranch, RefreshCw, Search, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import {
  loadConversationRebuildArchive,
  type ConversationRebuildArchive,
  type RebuildRelation,
  type SourceDialogueGroup
} from "../domain/loadConversationRebuildArchive";

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toLocaleString("en-US");
}

function formatAverage(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toFixed(2);
}

function StatCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rebuild-stat">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function topicColor(index: number): string {
  const colors = ["#235789", "#2a7f62", "#a35f00", "#7a4fb3", "#b43f62", "#52723b"];
  return colors[index % colors.length];
}

function RelationshipDiagram({
  group,
  selectedDialogueId,
  onSelectRelation
}: {
  group: SourceDialogueGroup | null;
  selectedDialogueId: string | null;
  onSelectRelation: (relation: RebuildRelation) => void;
}) {
  if (!group) {
    return (
      <div className="relationship-empty">
        Upload an archive to inspect source-topic rebuild relationships.
      </div>
    );
  }

  return (
    <div className="relationship-diagram" aria-label="Source-topic rebuild relationship diagram">
      <div className="source-node">
        <span>Source dialogue</span>
        <strong>{group.sourceDialogueId}</strong>
        <small>{group.sourceConversationId ?? "-"}</small>
      </div>
      <div className="relation-lanes">
        {group.relations.map((relation, index) => (
          <button
            type="button"
            key={relation.dialogueId}
            className={`relation-lane ${
              relation.dialogueId === selectedDialogueId ? "selected" : ""
            }`}
            onClick={() => onSelectRelation(relation)}
          >
            <span
              className="topic-dot"
              style={{ background: topicColor(index) }}
              aria-hidden="true"
            />
            <span className="relation-path">
              {relation.sourceDialogueId} -&gt; {relation.sourceTopicId} -&gt;{" "}
              {relation.dialogueId}
            </span>
            <strong>{relation.sourceTopicLabel}</strong>
            <small>{formatCount(relation.turnCount)} turns</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function RelationDetail({ relation }: { relation: RebuildRelation | null }) {
  if (!relation) {
    return (
      <aside className="relation-detail" aria-label="Selected rebuild relation">
        <p>No rebuild relation selected.</p>
      </aside>
    );
  }

  return (
    <aside className="relation-detail" aria-label="Selected rebuild relation">
      <p className="eyebrow">Selected rebuild</p>
      <h2>{relation.dialogueId}</h2>
      <div className="detail-metrics">
        <span>Source</span>
        <strong>{relation.sourceDialogueId}</strong>
        <span>Topic</span>
        <strong>{relation.sourceTopicId}</strong>
        <span>Strategy</span>
        <strong>{relation.generationStrategy ?? "-"}</strong>
        <span>Method</span>
        <strong>{relation.rebuildMethod ?? "-"}</strong>
      </div>
      {relation.topicDescription ? (
        <p className="topic-description">{relation.topicDescription}</p>
      ) : null}
      <div className="turn-stack">
        {relation.turns.map((turn, index) => (
          <p key={`${turn.messageId ?? "turn"}-${index}`}>
            <strong>{turn.sender}</strong>
            <span>{turn.text}</span>
          </p>
        ))}
      </div>
    </aside>
  );
}

function TopicSummaryTable({
  archive,
  selectedTopicId,
  onSelectTopic
}: {
  archive: ConversationRebuildArchive;
  selectedTopicId: string;
  onSelectTopic: (topicId: string) => void;
}) {
  return (
    <section className="rebuild-table-wrap">
      <div className="panel-heading">
        <h2>Topic coverage</h2>
      </div>
      <table className="rebuild-table" aria-label="Conversation rebuild topic coverage">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Label</th>
            <th>Rebuilt dialogues</th>
            <th>Source dialogues</th>
          </tr>
        </thead>
        <tbody>
          {archive.topicSummaries.map((topic) => (
            <tr
              key={topic.sourceTopicId}
              className={topic.sourceTopicId === selectedTopicId ? "selected-row" : ""}
            >
              <td>
                <button
                  type="button"
                  className="model-link"
                  onClick={() => onSelectTopic(topic.sourceTopicId)}
                >
                  {topic.sourceTopicId}
                </button>
              </td>
              <td>{topic.sourceTopicLabel}</td>
              <td>{formatCount(topic.rebuildCount)}</td>
              <td>{formatCount(topic.sourceDialogueCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SourceGroupTable({
  groups,
  selectedSourceDialogueId,
  onSelectGroup
}: {
  groups: SourceDialogueGroup[];
  selectedSourceDialogueId: string | null;
  onSelectGroup: (group: SourceDialogueGroup) => void;
}) {
  return (
    <section className="rebuild-table-wrap">
      <div className="panel-heading">
        <h2>Source dialogue splits</h2>
      </div>
      <table className="rebuild-table" aria-label="Conversation rebuild source dialogue splits">
        <thead>
          <tr>
            <th>Source dialogue</th>
            <th>Conversation</th>
            <th>Topics</th>
            <th>Rebuilds</th>
            <th>Turns</th>
            <th>Dataset</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr
              key={group.sourceDialogueId}
              className={group.sourceDialogueId === selectedSourceDialogueId ? "selected-row" : ""}
            >
              <td>
                <button
                  type="button"
                  className="model-link"
                  onClick={() => onSelectGroup(group)}
                >
                  {group.sourceDialogueId}
                </button>
              </td>
              <td>{group.sourceConversationId ?? "-"}</td>
              <td>{formatCount(group.topicCount)}</td>
              <td>{formatCount(group.rebuildCount)}</td>
              <td>{formatCount(group.totalTurns)}</td>
              <td>{group.sourceDataset ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RebuildDashboard({ archive }: { archive: ConversationRebuildArchive }) {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const topicFilteredGroups = useMemo(() => {
    if (!selectedTopicId) {
      return archive.sourceGroups;
    }
    return archive.sourceGroups
      .map((group) => ({
        ...group,
        rebuildCount: group.relations.filter(
          (relation) => relation.sourceTopicId === selectedTopicId
        ).length,
        topicCount: 1,
        totalTurns: group.relations
          .filter((relation) => relation.sourceTopicId === selectedTopicId)
          .reduce((sum, relation) => sum + relation.turnCount, 0),
        relations: group.relations.filter((relation) => relation.sourceTopicId === selectedTopicId)
      }))
      .filter((group) => group.relations.length > 0);
  }, [archive.sourceGroups, selectedTopicId]);
  const [selectedSourceDialogueId, setSelectedSourceDialogueId] = useState<string | null>(
    topicFilteredGroups[0]?.sourceDialogueId ?? null
  );
  const selectedGroup =
    topicFilteredGroups.find((group) => group.sourceDialogueId === selectedSourceDialogueId) ??
    topicFilteredGroups[0] ??
    null;
  const [selectedDialogueId, setSelectedDialogueId] = useState<string | null>(
    selectedGroup?.relations[0]?.dialogueId ?? null
  );
  const selectedRelation =
    selectedGroup?.relations.find((relation) => relation.dialogueId === selectedDialogueId) ??
    selectedGroup?.relations[0] ??
    null;
  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return topicFilteredGroups;
    }
    return topicFilteredGroups.filter((group) => {
      const haystack = [
        group.sourceDialogueId,
        group.sourceConversationId,
        group.sourceDataset,
        ...group.relations.flatMap((relation) => [
          relation.dialogueId,
          relation.sourceTopicId,
          relation.sourceTopicLabel,
          relation.topicDescription
        ])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [query, topicFilteredGroups]);

  function selectGroup(group: SourceDialogueGroup) {
    setSelectedSourceDialogueId(group.sourceDialogueId);
    setSelectedDialogueId(group.relations[0]?.dialogueId ?? null);
  }

  function selectTopic(topicId: string) {
    const group = archive.sourceGroups.find((candidate) =>
      candidate.relations.some((relation) => relation.sourceTopicId === topicId)
    );
    const relation = group?.relations.find((candidate) => candidate.sourceTopicId === topicId);
    setSelectedTopicId(topicId);
    setSelectedSourceDialogueId(group?.sourceDialogueId ?? null);
    setSelectedDialogueId(relation?.dialogueId ?? null);
  }

  return (
    <section className="rebuild-dashboard">
      <div className="rebuild-hero">
        <div>
          <p className="eyebrow">{archive.fileName}</p>
          <h1>Conversation Rebuild Relations</h1>
          <p className="benchmark-meta">{archive.title}</p>
        </div>
        <label className="rebuild-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search rebuilt conversations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search source, topic, dialogue"
          />
        </label>
        <label className="rebuild-topic-select">
          <span>Filter by rebuilt topic</span>
          <select
            aria-label="Filter by rebuilt topic"
            value={selectedTopicId}
            onChange={(event) => selectTopic(event.target.value)}
          >
            <option value="">All rebuilt topics</option>
            {archive.topicSummaries.map((topic) => (
              <option key={topic.sourceTopicId} value={topic.sourceTopicId}>
                {topic.sourceTopicId} · {topic.sourceTopicLabel} ·{" "}
                {formatCount(topic.rebuildCount)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {archive.warnings.length > 0 ? (
        <div className="warning-strip" role="status">
          {archive.warnings.join(" ")}
        </div>
      ) : null}

      <div className="rebuild-stats">
        <StatCard label="Rebuilt dialogues" value={formatCount(archive.totals.rebuiltDialogues)} />
        <StatCard label="Source dialogues" value={formatCount(archive.totals.sourceDialogues)} />
        <StatCard label="Source topics" value={formatCount(archive.totals.sourceTopics)} />
        <StatCard
          label="Average turns"
          value={formatAverage(archive.totals.averageTurns)}
          detail={`${formatCount(archive.totals.minTurns)}-${formatCount(
            archive.totals.maxTurns
          )} turns`}
        />
        <StatCard
          label="Dropped full rebuilds"
          value={formatCount(archive.totals.droppedFullDialogueRebuilds)}
        />
      </div>

      <div className="rebuild-layout">
        <section className="relationship-panel">
          <div className="panel-heading">
            <GitBranch size={18} aria-hidden="true" />
            <h2>Relationship map</h2>
          </div>
          <RelationshipDiagram
            group={selectedGroup}
            selectedDialogueId={selectedRelation?.dialogueId ?? null}
            onSelectRelation={(relation) => setSelectedDialogueId(relation.dialogueId)}
          />
        </section>
        <RelationDetail relation={selectedRelation} />
      </div>

      <SourceGroupTable
        groups={filteredGroups}
        selectedSourceDialogueId={selectedGroup?.sourceDialogueId ?? null}
        onSelectGroup={selectGroup}
      />
      <TopicSummaryTable
        archive={archive}
        selectedTopicId={selectedTopicId}
        onSelectTopic={selectTopic}
      />
    </section>
  );
}

interface ConversationRebuildPageProps {
  onBackToEvaluation: () => void;
}

export function ConversationRebuildPage({ onBackToEvaluation }: ConversationRebuildPageProps) {
  const [archive, setArchive] = useState<ConversationRebuildArchive | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      setArchive(await loadConversationRebuildArchive(file));
    } catch (loadError) {
      setArchive(null);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load conversation rebuild archive"
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
    <section className="rebuild-page">
      <div
        className={`archive-dropzone ${archive ? "compact" : ""} ${
          dragActive ? "drag-active" : ""
        }`}
        aria-label="Drop conversation rebuild zip"
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
            <h1>Conversation Rebuild Relations</h1>
            <p>Drop a conversation rebuild archive or choose a zip file.</p>
          </div>
        )}
        <div className="archive-actions">
          <label className="file-picker">
            <span>{loading ? "Loading..." : "Choose zip"}</span>
            <input
              aria-label="Upload conversation rebuild zip"
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

      {archive ? <RebuildDashboard archive={archive} /> : null}
    </section>
  );
}
