import { useState } from "react";
import { Upload } from "lucide-react";

interface UploadPanelProps {
  loading: boolean;
  error: string | null;
  title?: string;
  description?: string;
  buttonLabel?: string;
  accept?: string;
  inputLabel?: string;
  sectionLabel?: string;
  onFileSelected: (file: File) => void;
}

export function UploadPanel({
  loading,
  error,
  title = "Evaluation Review",
  description = "Upload one evaluation zip. The file is parsed in this browser.",
  buttonLabel = "Choose zip",
  accept = ".zip,application/zip",
  inputLabel = "Upload evaluation zip",
  sectionLabel = "Upload evaluation artifact",
  onFileSelected
}: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);

  function selectFile(file: File | undefined) {
    if (!loading && file) {
      onFileSelected(file);
    }
  }

  return (
    <section
      className={dragActive ? "upload-panel drag-active" : "upload-panel"}
      aria-label={sectionLabel}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        selectFile(event.dataTransfer.files[0]);
      }}
    >
      <div className="upload-icon" aria-hidden="true">
        <Upload size={32} />
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      <label className="file-picker">
        <span>{loading ? "Loading..." : dragActive ? "Drop to upload" : buttonLabel}</span>
        <input
          aria-label={inputLabel}
          type="file"
          accept={accept}
          disabled={loading}
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
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
