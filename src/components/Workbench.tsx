import type { ReviewDataset } from "../domain/types";

interface WorkbenchProps {
  dataset: ReviewDataset;
}

export function Workbench({ dataset }: WorkbenchProps) {
  const firstDialogue = dataset.dialogues[0];

  return (
    <section className="workbench">
      <header className="summary-band">
        <h1>{dataset.artifact}</h1>
        <p>{dataset.dialogues.length} dialogues loaded</p>
      </header>
      <aside className="dialogue-list" aria-label="Dialogue list">
        {dataset.dialogues.map((dialogue) => (
          <button key={dialogue.dialogue_id} className="dialogue-list-item" type="button">
            Dialogue {dialogue.dialogue_id}
          </button>
        ))}
      </aside>
      <section className="detail-pane">
        {firstDialogue ? <h2>Dialogue {firstDialogue.dialogue_id}</h2> : <h2>No dialogues</h2>}
      </section>
    </section>
  );
}
