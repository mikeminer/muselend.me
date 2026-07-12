import { describe, expect, it } from "vitest";
import { eventLabel, historyRanges } from "./position-history";

describe("position history", () => {
  it("partitions an inclusive block interval without gaps", () => {
    expect(historyRanges(5n, 20_010n)).toEqual([
      { start: 5n, end: 10_004n },
      { start: 10_005n, end: 20_004n },
      { start: 20_005n, end: 20_010n },
    ]);
  });

  it("returns no pages when deployment is ahead of the head", () => {
    expect(historyRanges(11n, 10n)).toEqual([]);
  });

  it("rejects an unbounded browser history scan", () => {
    expect(() => historyRanges(0n, 2_500_000n)).toThrow("bounded browser scan");
  });

  it("describes the economic meaning of lifecycle events", () => {
    expect(eventLabel("PositionOpened")).toContain("token sold");
    expect(eventLabel("PositionDefaulted")).toBe("Position defaulted");
  });
});
