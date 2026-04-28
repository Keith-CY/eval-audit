export function parseJsonl<T>(text: string, sourceName: string): T[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, lineNumber }) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(
          `${sourceName} line ${lineNumber}: ${(error as Error).message}`
        );
      }
    });
}

export function stringifyJsonl(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}
