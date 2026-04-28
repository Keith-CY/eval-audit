import { useState } from "react";
import { UploadPanel } from "./components/UploadPanel";
import { Workbench } from "./components/Workbench";
import { loadEvaluationZip } from "./domain/loadEvaluationZip";
import type { ReviewDataset } from "./domain/types";

export default function App() {
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
      {dataset ? (
        <Workbench dataset={dataset} />
      ) : (
        <UploadPanel loading={loading} error={error} onFileSelected={handleFileSelected} />
      )}
    </main>
  );
}
