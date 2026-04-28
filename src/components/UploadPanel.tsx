import { Upload } from "lucide-react";

interface UploadPanelProps {
  loading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}

export function UploadPanel({ loading, error, onFileSelected }: UploadPanelProps) {
  return (
    <section className="upload-panel" aria-label="Upload evaluation artifact">
      <div className="upload-icon" aria-hidden="true">
        <Upload size={32} />
      </div>
      <h1>Evaluation Review</h1>
      <p>Upload one evaluation zip. The file is parsed in this browser.</p>
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
