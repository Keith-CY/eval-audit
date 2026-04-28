import { describe, expect, it } from "vitest";
import { formatCount, formatMetric, formatOptionalMetric } from "./format";

describe("metric formatting", () => {
  it("formats numbers as percentages with one decimal place", () => {
    expect(formatMetric(0.3652)).toBe("36.5%");
  });

  it("formats optional metrics with a dash for null values", () => {
    expect(formatOptionalMetric(null)).toBe("-");
    expect(formatOptionalMetric(1)).toBe("100.0%");
  });

  it("formats counts with thousands separators and missing-value dashes", () => {
    expect(formatCount(null)).toBe("-");
    expect(formatCount(undefined)).toBe("-");
    expect(formatCount(1200)).toBe("1,200");
  });
});
