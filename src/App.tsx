import { useState } from "react";
import { FlatEventsWorkbench } from "./components/FlatEventsWorkbench";
import { UploadPanel } from "./components/UploadPanel";
import { Workbench } from "./components/Workbench";
import { loadFlatEventsZip } from "./domain/loadFlatEventsZip";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import type { FlatEventsDataset, ReviewDataset } from "./domain/types";

type ActiveTab = "evaluation" | "flat";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("evaluation");
  const [dataset, setDataset] = useState<ReviewDataset | null>(null);
  const [flatDataset, setFlatDataset] = useState<FlatEventsDataset | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [flatLoading, setFlatLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [flatError, setFlatError] = useState<string | null>(null);

  async function handleEvaluationFileSelected(file: File) {
    setEvaluationLoading(true);
    setEvaluationError(null);

    try {
      setDataset(await loadEvaluationZip(file));
    } catch (loadError) {
      setDataset(null);
      setEvaluationError(
        loadError instanceof Error ? loadError.message : "Could not load evaluation zip"
      );
    } finally {
      setEvaluationLoading(false);
    }
  }

  async function handleFlatFileSelected(file: File) {
    setFlatLoading(true);
    setFlatError(null);

    try {
      setFlatDataset(await loadFlatEventsZip(file));
    } catch (loadError) {
      setFlatDataset(null);
      setFlatError(
        loadError instanceof Error ? loadError.message : "Could not load flat events ZIP"
      );
    } finally {
      setFlatLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="mode-tabs" role="tablist" aria-label="Artifact type">
        <button
          aria-selected={activeTab === "evaluation"}
          role="tab"
          type="button"
          onClick={() => setActiveTab("evaluation")}
        >
          Evaluation zip
        </button>
        <button
          aria-selected={activeTab === "flat"}
          role="tab"
          type="button"
          onClick={() => setActiveTab("flat")}
        >
          Flat events JSONL
        </button>
      </nav>
      {activeTab === "evaluation" ? (
        dataset ? (
          <Workbench dataset={dataset} />
        ) : (
          <UploadPanel
            loading={evaluationLoading}
            error={evaluationError}
            onFileSelected={handleEvaluationFileSelected}
          />
        )
      ) : flatDataset ? (
        <FlatEventsWorkbench dataset={flatDataset} />
      ) : (
        <UploadPanel
          loading={flatLoading}
          error={flatError}
          title="Flat Events Review"
          description="Upload a ZIP containing events.flat.jsonl and (optionally) a dialogue source JSONL. Both files are parsed in this browser."
          buttonLabel="Choose ZIP"
          accept=".zip,application/zip"
          inputLabel="Upload flat events ZIP"
          sectionLabel="Upload flat events artifact"
          onFileSelected={handleFlatFileSelected}
        />
      )}
    </main>
  );
}
