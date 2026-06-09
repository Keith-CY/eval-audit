import { useState } from "react";
import { Upload } from "lucide-react";

interface SemanticEventAuditImportPanelProps {
  loading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
  onGitHubImport: (input: { token: string; directoryUrl: string }) => void;
}

export function SemanticEventAuditImportPanel({
  loading,
  error,
  onFileSelected,
  onGitHubImport
}: SemanticEventAuditImportPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [token, setToken] = useState("");
  const [directoryUrl, setDirectoryUrl] = useState("");

  function selectFile(file: File | undefined) {
    if (!loading && file) {
      onFileSelected(file);
    }
  }

  return (
    <section
      className={dragActive ? "semantic-import-panel drag-active" : "semantic-import-panel"}
      aria-label="Upload semantic event audit"
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
      <h1>Semantic Event Audit</h1>
      <p>Drop or choose an event audit Archive.zip, or load an extracted archive directory from GitHub.</p>
      <div className="semantic-import-methods">
        <div className="semantic-import-method">
          <h2>Archive.zip</h2>
          <p>Use the report archive with semantic-f1 artifacts and dialogue extraction files.</p>
          <label className="file-picker">
            <span>{loading ? "Loading..." : dragActive ? "Drop to upload" : "Choose Archive"}</span>
            <input
              aria-label="Upload semantic audit archive"
              type="file"
              accept=".zip,application/zip"
              disabled={loading}
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
        </div>
        <form
          className="semantic-import-method"
          onSubmit={(event) => {
            event.preventDefault();
            if (!loading) {
              onGitHubImport({ token, directoryUrl });
            }
          }}
        >
          <div className="semantic-import-title">
            <h2>GitHub directory</h2>
          </div>
          <label>
            <span>GitHub token</span>
            <input
              aria-label="GitHub token"
              autoComplete="off"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ghp_..."
            />
          </label>
          <label>
            <span>GitHub directory URL</span>
            <input
              aria-label="GitHub directory URL"
              type="url"
              value={directoryUrl}
              onChange={(event) => setDirectoryUrl(event.target.value)}
              placeholder="https://github.com/owner/repo/tree/main/path"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Load GitHub directory"}
          </button>
        </form>
      </div>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
