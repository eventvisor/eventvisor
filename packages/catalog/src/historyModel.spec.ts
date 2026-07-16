import {
  HISTORY_VISIBLE_ENTITY_LIMIT,
  formatHistoryTimestamp,
  getHistoryCommitUrl,
} from "./historyModel";

describe("catalog history", () => {
  it("supports both commit URL placeholders", () => {
    expect(getHistoryCommitUrl("https://example.com/commit/{{hash}}", "abc123")).toBe(
      "https://example.com/commit/abc123",
    );
    expect(getHistoryCommitUrl("https://example.com/commit/{{commit}}", "abc123")).toBe(
      "https://example.com/commit/abc123",
    );
    expect(getHistoryCommitUrl(undefined, "abc123")).toBeUndefined();
  });

  it("keeps invalid timestamps readable", () => {
    expect(formatHistoryTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatHistoryTimestamp("2026-07-16T10:00:00.000Z")).not.toBe("2026-07-16T10:00:00.000Z");
  });

  it("uses the same compact entity limit as Featurevisor", () => {
    expect(HISTORY_VISIBLE_ENTITY_LIMIT).toBe(10);
  });
});
