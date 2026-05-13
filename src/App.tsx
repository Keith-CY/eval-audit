import { useState } from "react";
import { BarChart3, ClipboardList, GitBranch } from "lucide-react";
import { BenchmarkArchivePage } from "./components/BenchmarkArchivePage";
import { ConversationRebuildPage } from "./components/ConversationRebuildPage";
import { UploadPanel } from "./components/UploadPanel";
import { Workbench } from "./components/Workbench";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import type { ReviewDataset } from "./domain/types";

type AppPage = "evaluation" | "benchmark" | "rebuild";

export default function App() {
  const [page, setPage] = useState<AppPage>("evaluation");
  const [dataset, setDataset] = useState<ReviewDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setLoading(true);
    setError(null);

    try {
      setDataset(await loadEvaluationZip(file));
    } catch (loadError) {
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load evaluation zip");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="app-nav" aria-label="Review modes">
        <button
          type="button"
          className={page === "evaluation" ? "active" : ""}
          onClick={() => setPage("evaluation")}
        >
          <ClipboardList size={16} aria-hidden="true" />
          Evaluation review
        </button>
        <button
          type="button"
          className={page === "benchmark" ? "active" : ""}
          onClick={() => setPage("benchmark")}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Benchmark compare
        </button>
        <button
          type="button"
          className={page === "rebuild" ? "active" : ""}
          onClick={() => setPage("rebuild")}
        >
          <GitBranch size={16} aria-hidden="true" />
          Conversation rebuild
        </button>
      </nav>
      {page === "benchmark" ? (
        <BenchmarkArchivePage onBackToEvaluation={() => setPage("evaluation")} />
      ) : page === "rebuild" ? (
        <ConversationRebuildPage onBackToEvaluation={() => setPage("evaluation")} />
      ) : dataset ? (
        <Workbench dataset={dataset} />
      ) : (
        <UploadPanel loading={loading} error={error} onFileSelected={handleFileSelected} />
      )}
    </main>
  );
}
