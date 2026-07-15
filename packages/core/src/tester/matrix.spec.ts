import type { AssertionMatrix } from "@eventvisor/types";

import { expandAssertions, getMatrixCombinations } from "./matrix";

describe("test assertion matrices", () => {
  it("creates the cartesian product in declaration order", () => {
    expect(getMatrixCombinations({ country: ["NL", "DE"], signedIn: [true, false] })).toEqual([
      { country: "NL", signedIn: true },
      { country: "NL", signedIn: false },
      { country: "DE", signedIn: true },
      { country: "DE", signedIn: false },
    ]);
  });

  it("applies typed placeholders recursively without mutating the authored assertion", () => {
    const authored: {
      matrix: AssertionMatrix;
      track: { count: string; label: string };
    } = {
      matrix: { count: [1, 2] },
      track: { count: "${{ count }}", label: "count-${{ count }}" },
    };
    const expanded = expandAssertions([authored]);
    expect(expanded.map((entry) => entry.assertion.track)).toEqual([
      { count: 1, label: "count-1" },
      { count: 2, label: "count-2" },
    ]);
    expect(authored.matrix).toEqual({ count: [1, 2] });
  });
});
