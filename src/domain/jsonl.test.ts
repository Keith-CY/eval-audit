import { describe, expect, it } from "vitest";
import { parseJsonl, stringifyJsonl } from "./jsonl";

describe("parseJsonl", () => {
  it("parses non-empty JSONL lines and skips blank lines", () => {
    const rows = parseJsonl<{ id: string }>('{"id":"a"}\n\n{"id":"b"}\n', "rows.jsonl");
    expect(rows).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("reports file name and one-based line number on invalid JSON", () => {
    expect(() => parseJsonl('{"id":"a"}\nnot-json\n', "rows.jsonl")).toThrow(
      "rows.jsonl line 2"
    );
  });
});

describe("stringifyJsonl", () => {
  it("serializes each record on its own line and ends with a newline", () => {
    expect(stringifyJsonl([{ id: "a" }, { id: "b" }])).toBe('{"id":"a"}\n{"id":"b"}\n');
  });

  it("serializes empty records to an empty string", () => {
    expect(stringifyJsonl([])).toBe("");
  });
});
