import { useState, type DragEvent } from "react";
import { Upload } from "lucide-react";

interface UploadPanelProps {
  loading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}

export function UploadPanel({ loading, error, onFileSelected }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (loading) {
      event.dataTransfer.dropEffect = "none";
      return;
    }

    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);

    if (loading) return;

    const files = event.dataTransfer.files;
    const file = files.item?.(0) ?? files[0];
    if (file) onFileSelected(file);
  }

  return (
    <section
      className={dragActive ? "upload-panel drag-active" : "upload-panel"}
      aria-label="Upload evaluation artifact"
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="upload-icon" aria-hidden="true">
        <Upload size={32} />
      </div>
      <h1>Evaluation Review</h1>
      <p>Upload one evaluation zip. The file is parsed in this browser.</p>
      <p className="upload-hint">
        {dragActive ? "Drop zip to load" : "Drag zip here or choose it below"}
      </p>
      <label className="file-picker">
        <span>{loading ? "Loading..." : "Choose zip"}</span>
        <input
          aria-label="Upload evaluation zip"
          type="file"
          accept=".zip,application/zip"
          disabled={loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelected(file);
          }}
        />
      </label>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
