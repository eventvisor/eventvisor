import { applyMatrix, combinations } from "../testModel";

describe("Catalog test matrices", () => {
  it("creates every matrix combination", () => {
    expect(combinations({ country: ["nl", "de"], signedIn: [true, false] })).toEqual([
      { country: "nl", signedIn: true },
      { country: "nl", signedIn: false },
      { country: "de", signedIn: true },
      { country: "de", signedIn: false },
    ]);
  });

  it("substitutes exact and embedded matrix values recursively", () => {
    expect(
      applyMatrix(
        { event: { width: "${{ width }}", label: "screen-${{ width }}" } },
        { width: 320 },
      ),
    ).toEqual({
      event: { width: 320, label: "screen-320" },
    });
  });
});
