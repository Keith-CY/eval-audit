import { useEffect, useMemo, useState } from "react";
import {
  clearAnnotations,
  exportAnnotations,
  getExportableAnnotations,
  loadAnnotations,
  saveAnnotations,
  type AnnotationMap
} from "../domain/annotations";
import {
  filterDialogues,
  type EvaluationStatusFilter,
  type ReviewStatusFilter
} from "../domain/filters";
import type { Annotation, ReviewDataset, ReviewStatus, RowAudit } from "../domain/types";
import { AnnotationPanel } from "./AnnotationPanel";
import { DialogueDetail } from "./DialogueDetail";
import { DialogueList } from "./DialogueList";
import { SummaryBar } from "./SummaryBar";

interface WorkbenchProps {
  dataset: ReviewDataset;
}

function rowsByDialogueId(dialogues: ReviewDataset["dialogues"]): Map<string, RowAudit> {
  return new Map(
    dialogues
      .filter((dialogue) => dialogue.rowAudit)
      .map((dialogue) => [dialogue.dialogue_id, dialogue.rowAudit as RowAudit])
  );
}

function downloadText(filename: string, text: string): void {
  if (typeof URL.createObjectURL !== "function") {
    return;
  }

  const blob = new Blob([text], { type: "application/jsonl;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const storageWarning =
  "Browser storage is unavailable. Current annotations are kept in memory; export before leaving this page.";

export function Workbench({ dataset }: WorkbenchProps) {
  const [annotations, setAnnotations] = useState<AnnotationMap>(() =>
    loadAnnotations(dataset.artifact)
  );
  const [annotationWarning, setAnnotationWarning] = useState<string | null>(null);
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(
    dataset.dialogues[0]?.dialogue_id ?? null
  );
  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("all");
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatusFilter>("all");

  useEffect(() => {
    setAnnotations(loadAnnotations(dataset.artifact));
    setAnnotationWarning(null);
    setActiveDialogueId(dataset.dialogues[0]?.dialogue_id ?? null);
    setSearch("");
    setReviewStatus("all");
    setEvaluationStatus("all");
  }, [dataset]);

  function persistAnnotations(nextAnnotations: AnnotationMap) {
    setAnnotations(nextAnnotations);

    if (saveAnnotations(dataset.artifact, nextAnnotations)) {
      setAnnotationWarning(null);
    } else {
      setAnnotationWarning(storageWarning);
    }
  }

  const filteredDialogues = useMemo(
    () =>
      filterDialogues({
        dialogues: dataset.dialogues,
        annotations,
        search,
        reviewStatus,
        evaluationStatus
      }),
    [annotations, dataset.dialogues, evaluationStatus, reviewStatus, search]
  );

  const activeDialogue =
    filteredDialogues.find((dialogue) => dialogue.dialogue_id === activeDialogueId) ??
    filteredDialogues[0] ??
    null;
  const activeAnnotation = activeDialogue
    ? annotations[activeDialogue.dialogue_id] ?? {
        artifact: dataset.artifact,
        dialogue_id: activeDialogue.dialogue_id,
        row_index: activeDialogue.row_index,
        review_status: "unreviewed" as ReviewStatus,
        review_note: "",
        updated_at: ""
      }
    : null;
  const exportableCount = getExportableAnnotations(annotations).length;
  const reviewedCount = Object.values(annotations).filter(
    (annotation) => annotation.review_status !== "unreviewed"
  ).length;
  const activeIndex = activeDialogue
    ? filteredDialogues.findIndex((dialogue) => dialogue.dialogue_id === activeDialogue.dialogue_id)
    : -1;

  function updateActiveAnnotation(next: Partial<Annotation>) {
    if (!activeDialogue || !activeAnnotation) {
      return;
    }

    const updated: Annotation = {
      ...activeAnnotation,
      ...next,
      updated_at: new Date().toISOString()
    };
    const nextAnnotations = { ...annotations, [activeDialogue.dialogue_id]: updated };
    persistAnnotations(nextAnnotations);
  }

  function clearCurrent() {
    if (!activeDialogue) {
      return;
    }

    const nextAnnotations = { ...annotations };
    delete nextAnnotations[activeDialogue.dialogue_id];
    persistAnnotations(nextAnnotations);
  }

  function clearAll() {
    setAnnotations({});
    if (clearAnnotations(dataset.artifact)) {
      setAnnotationWarning(null);
    } else {
      setAnnotationWarning(storageWarning);
    }
  }

  function exportJsonl() {
    if (exportableCount === 0) {
      return;
    }

    const jsonl = exportAnnotations({
      annotations,
      rowsByDialogueId: rowsByDialogueId(dataset.dialogues),
      exportedAt: new Date().toISOString()
    });

    if (jsonl.length > 0) {
      downloadText(`${dataset.artifact}-annotations.jsonl`, jsonl);
    }
  }

  const warnings = annotationWarning ? [...dataset.warnings, annotationWarning] : dataset.warnings;

  return (
    <section className="workbench">
      <SummaryBar
        summary={dataset.summary}
        reviewedCount={reviewedCount}
        exportableCount={exportableCount}
      />
      {warnings.length > 0 ? (
        <div className="warning-strip" role="status" aria-label="Dataset warnings">
          {warnings.join(" ")}
        </div>
      ) : null}
      <div className="workbench-grid">
        <DialogueList
          dialogues={filteredDialogues}
          activeDialogueId={activeDialogue?.dialogue_id ?? null}
          annotations={annotations}
          search={search}
          reviewStatus={reviewStatus}
          evaluationStatus={evaluationStatus}
          onSearchChange={setSearch}
          onReviewStatusChange={setReviewStatus}
          onEvaluationStatusChange={setEvaluationStatus}
          onSelectDialogue={setActiveDialogueId}
        />
        <div className="detail-stack">
          <DialogueDetail
            dialogue={activeDialogue}
            canGoPrevious={activeIndex > 0}
            canGoNext={activeIndex >= 0 && activeIndex < filteredDialogues.length - 1}
            onPrevious={() => {
              const previous = filteredDialogues[activeIndex - 1];
              if (previous) {
                setActiveDialogueId(previous.dialogue_id);
              }
            }}
            onNext={() => {
              const next = filteredDialogues[activeIndex + 1];
              if (next) {
                setActiveDialogueId(next.dialogue_id);
              }
            }}
          />
          <AnnotationPanel
            status={activeAnnotation?.review_status ?? "unreviewed"}
            note={activeAnnotation?.review_note ?? ""}
            exportableCount={exportableCount}
            disabled={!activeDialogue}
            onStatusChange={(status) => updateActiveAnnotation({ review_status: status })}
            onNoteChange={(note) => updateActiveAnnotation({ review_note: note })}
            onSave={() => updateActiveAnnotation({})}
            onClearCurrent={clearCurrent}
            onClearAll={clearAll}
            onExport={exportJsonl}
          />
        </div>
      </div>
    </section>
  );
}
