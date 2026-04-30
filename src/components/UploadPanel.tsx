import { useState, type DragEvent } from "react";
import { Upload } from "lucide-react";

interface UploadPanelProps {
  loading: boolean;
  error: string | null;
  onFilesSelected: (files: File[]) => void;
}

export function UploadPanel({ loading, error, onFilesSelected }: UploadPanelProps) {
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

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
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
      <p>Upload one or more evaluation zips. Files are parsed in this browser.</p>
      <p className="upload-hint">
        {dragActive ? "Drop zips to load" : "Drag zips here or choose them below"}
      </p>
      <label className="file-picker">
        <span>{loading ? "Loading..." : "Choose zips"}</span>
        <input
          aria-label="Upload evaluation zip"
          type="file"
          accept=".zip,application/zip"
          multiple
          disabled={loading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onFilesSelected(files);
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
