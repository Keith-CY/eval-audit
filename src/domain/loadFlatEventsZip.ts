import JSZip from "jszip";
import { parseJsonl } from "./jsonl";
import { parseFlatEventsText } from "./loadFlatEventsJsonl";
import type { FlatEventsDataset } from "./types";

const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const MAX_TEXT_CHARS = 100 * 1024 * 1024;

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function readZipEntry(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`ZIP entry not found: ${path}`);
  }
  const text = await entry.async("text");
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(
      `${path} is too large after decompression. Maximum is ${formatMegabytes(MAX_TEXT_CHARS)}.`
    );
  }
  return text;
}

export async function loadFlatEventsZip(file: File): Promise<FlatEventsDataset> {
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(
      `ZIP file is too large. Maximum supported size is ${formatMegabytes(MAX_ZIP_BYTES)}.`
    );
  }

  const zip = await JSZip.loadAsync(file);
  const allPaths = Object.keys(zip.files).filter((path) => {
    if (zip.files[path].dir) return false;
    // Skip macOS metadata entries (__MACOSX/ folder and AppleDouble ._* files)
    const basename = path.split("/").pop() ?? path;
    return !path.startsWith("__MACOSX/") && !basename.startsWith("._");
  });

  // Match files whose name contains ".jsonl" (handles "foo.jsonl copy" etc.)
  const jsonlPaths = allPaths.filter((path) => /\.jsonl/.test(path));

  if (jsonlPaths.length === 0) {
    throw new Error("ZIP must contain at least one .jsonl file (flat events).");
  }

  // Prefer a file explicitly named with ".flat.jsonl"; fall back to any .jsonl
  const eventsPath =
    jsonlPaths.find((path) => /\.flat\.jsonl/.test(path)) ?? jsonlPaths[0];

  // Dialogue source file: first .jsonl that is not the events file
  const dialoguePath = jsonlPaths.find((path) => path !== eventsPath) ?? null;

  const eventsText = await readZipEntry(zip, eventsPath);
  const dataset = parseFlatEventsText(eventsText, eventsPath, file.name);

  if (dialoguePath) {
    const dialogueText = await readZipEntry(zip, dialoguePath);
    const rawRecords = parseJsonl<Record<string, unknown>>(dialogueText, dialoguePath);

    const dialogueMap = new Map<string, string[]>();
    for (const record of rawRecords) {
      const id = record.dialogue_id;
      const lines = record.dialogue;
      if (typeof id === "string" && Array.isArray(lines) && lines.every((l) => typeof l === "string")) {
        dialogueMap.set(id, lines as string[]);
      }
    }

    if (dialogueMap.size > 0) {
      dataset.hasDialogueText = true;
      for (const dialogue of dataset.dialogues) {
        dialogue.dialogue = dialogueMap.get(dialogue.dialogue_id) ?? null;
      }
    }
  }

  return dataset;
}
