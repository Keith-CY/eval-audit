import "@testing-library/jest-dom/vitest";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

if (
  typeof globalThis.Storage === "undefined" ||
  typeof globalThis.localStorage?.clear !== "function"
) {
  Object.defineProperty(globalThis, "Storage", {
    configurable: true,
    value: MemoryStorage
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage()
  });
}
