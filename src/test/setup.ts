import "@testing-library/jest-dom/vitest";

const localStorageData = new Map<string, string>();

function installLocalStorageShim() {
  if (typeof Storage === "undefined") {
    return;
  }

  const prototype = Storage.prototype;
  Object.defineProperties(prototype, {
    clear: {
      configurable: true,
      value() {
        localStorageData.clear();
      }
    },
    getItem: {
      configurable: true,
      value(key: string) {
        return localStorageData.get(String(key)) ?? null;
      }
    },
    key: {
      configurable: true,
      value(index: number) {
        return Array.from(localStorageData.keys())[index] ?? null;
      }
    },
    removeItem: {
      configurable: true,
      value(key: string) {
        localStorageData.delete(String(key));
      }
    },
    setItem: {
      configurable: true,
      value(key: string, value: string) {
        localStorageData.set(String(key), String(value));
      }
    }
  });

  const storage = Object.create(prototype) as Storage;
  Object.defineProperty(storage, "length", {
    configurable: true,
    get() {
      return localStorageData.size;
    }
  });

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage
    });
  }
}

if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
  installLocalStorageShim();
}
