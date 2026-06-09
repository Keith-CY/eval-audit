import { useState } from "react";
import { GoldTopicDatasetWorkbench } from "./components/GoldTopicDatasetWorkbench";
import { SemanticEventAuditImportPanel } from "./components/SemanticEventAuditImportPanel";
import { SemanticEventAuditWorkbench } from "./components/SemanticEventAuditWorkbench";
import { UploadPanel } from "./components/UploadPanel";
import { Workbench } from "./components/Workbench";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import { loadGoldTopicDataset } from "./domain/loadGoldTopicDataset";
import {
  loadSemanticEventAuditFromGitHub,
  loadSemanticEventAuditZip
} from "./domain/loadSemanticEventAudit";
import type { GoldTopicDataset, ReviewDataset, SemanticEventAuditDataset } from "./domain/types";

type ActiveTab = "evaluation" | "semantic" | "gold-topic";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("evaluation");
  const [dataset, setDataset] = useState<ReviewDataset | null>(null);
  const [semanticDataset, setSemanticDataset] = useState<SemanticEventAuditDataset | null>(null);
  const [goldTopicDataset, setGoldTopicDataset] = useState<GoldTopicDataset | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [goldTopicLoading, setGoldTopicLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [goldTopicError, setGoldTopicError] = useState<string | null>(null);

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

  async function handleSemanticFileSelected(file: File) {
    setSemanticLoading(true);
    setSemanticError(null);

    try {
      setSemanticDataset(await loadSemanticEventAuditZip(file));
    } catch (loadError) {
      setSemanticDataset(null);
      setSemanticError(
        loadError instanceof Error ? loadError.message : "Could not load semantic event audit"
      );
    } finally {
      setSemanticLoading(false);
    }
  }

  async function handleSemanticGitHubImport(input: { token: string; directoryUrl: string }) {
    setSemanticLoading(true);
    setSemanticError(null);

    try {
      setSemanticDataset(await loadSemanticEventAuditFromGitHub(input));
    } catch (loadError) {
      setSemanticDataset(null);
      setSemanticError(
        loadError instanceof Error ? loadError.message : "Could not load GitHub directory"
      );
    } finally {
      setSemanticLoading(false);
    }
  }

  async function handleGoldTopicFileSelected(file: File) {
    setGoldTopicLoading(true);
    setGoldTopicError(null);

    try {
      setGoldTopicDataset(await loadGoldTopicDataset(file));
    } catch (loadError) {
      setGoldTopicDataset(null);
      setGoldTopicError(
        loadError instanceof Error ? loadError.message : "Could not load gold topic dataset"
      );
    } finally {
      setGoldTopicLoading(false);
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
          aria-selected={activeTab === "semantic"}
          role="tab"
          type="button"
          onClick={() => setActiveTab("semantic")}
        >
          Semantic event audit
        </button>
        <button
          aria-selected={activeTab === "gold-topic"}
          role="tab"
          type="button"
          onClick={() => setActiveTab("gold-topic")}
        >
          Gold topic dataset
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
      ) : activeTab === "semantic" ? (
        semanticDataset ? (
          <SemanticEventAuditWorkbench dataset={semanticDataset} />
        ) : (
          <SemanticEventAuditImportPanel
            loading={semanticLoading}
            error={semanticError}
            onFileSelected={handleSemanticFileSelected}
            onGitHubImport={handleSemanticGitHubImport}
          />
        )
      ) : goldTopicDataset ? (
        <GoldTopicDatasetWorkbench dataset={goldTopicDataset} />
      ) : (
        <UploadPanel
          loading={goldTopicLoading}
          error={goldTopicError}
          title="Gold Topic Dataset"
          description="Upload one gold topic JSONL file. The file is parsed in this browser."
          buttonLabel="Choose JSONL"
          accept=".jsonl,application/jsonl,application/x-ndjson,application/json"
          inputLabel="Upload gold topic dataset JSONL"
          sectionLabel="Upload gold topic dataset"
          onFileSelected={handleGoldTopicFileSelected}
        />
      )}
    </main>
  );
}
