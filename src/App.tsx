import { useState } from "react";
import { ComparisonView } from "./components/ComparisonView";
import { UploadPanel } from "./components/UploadPanel";
import { Workbench } from "./components/Workbench";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import type { LoadedEvaluation } from "./domain/types";

const comparisonTabId = "all-results";

function tabLabel(evaluation: LoadedEvaluation, index: number): string {
  return evaluation.dataset.artifact || `Eval ${index + 1}`;
}

function DatasetTabs({
  evaluations,
  activeTabId,
  onTabChange
}: {
  evaluations: LoadedEvaluation[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}) {
  return (
    <nav className="dataset-tabs" aria-label="Evaluation result tabs" role="tablist">
      {evaluations.map((evaluation, index) => (
        <button
          key={evaluation.id}
          type="button"
          role="tab"
          aria-selected={activeTabId === evaluation.id ? "true" : "false"}
          className={activeTabId === evaluation.id ? "dataset-tab active" : "dataset-tab"}
          onClick={() => onTabChange(evaluation.id)}
        >
          <span>{tabLabel(evaluation, index)}</span>
          <small>{evaluation.fileName}</small>
        </button>
      ))}
      {evaluations.length > 1 ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeTabId === comparisonTabId ? "true" : "false"}
          className={activeTabId === comparisonTabId ? "dataset-tab active" : "dataset-tab"}
          onClick={() => onTabChange(comparisonTabId)}
        >
          <span>All results</span>
          <small>{evaluations.length} evals</small>
        </button>
      ) : null}
    </nav>
  );
}

export default function App() {
  const [evaluations, setEvaluations] = useState<LoadedEvaluation[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const loadedEvaluations: LoadedEvaluation[] = [];

      for (const [index, file] of files.entries()) {
        const dataset = await loadEvaluationZip(file);
        loadedEvaluations.push({
          id: `${dataset.artifact}-${index}-${file.name}`,
          fileName: file.name,
          dataset
        });
      }

      setEvaluations(loadedEvaluations);
      setActiveTabId(loadedEvaluations[0]?.id ?? null);
    } catch (loadError) {
      setEvaluations([]);
      setActiveTabId(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load evaluation zip");
    } finally {
      setLoading(false);
    }
  }

  const activeEvaluation =
    evaluations.find((evaluation) => evaluation.id === activeTabId) ?? evaluations[0] ?? null;
  const resolvedActiveTabId = activeTabId ?? activeEvaluation?.id ?? comparisonTabId;

  return (
    <main className="app-shell">
      {evaluations.length > 0 && activeEvaluation ? (
        <>
          {evaluations.length > 1 ? (
            <DatasetTabs
              evaluations={evaluations}
              activeTabId={resolvedActiveTabId}
              onTabChange={setActiveTabId}
            />
          ) : null}
          {resolvedActiveTabId === comparisonTabId ? (
            <ComparisonView evaluations={evaluations} />
          ) : (
            <Workbench dataset={activeEvaluation.dataset} />
          )}
        </>
      ) : (
        <UploadPanel loading={loading} error={error} onFilesSelected={handleFilesSelected} />
      )}
    </main>
  );
}
