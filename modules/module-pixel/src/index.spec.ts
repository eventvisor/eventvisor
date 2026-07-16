import { createPixelModule } from "./index.js";

describe("createPixelModule", () => {
  it("reports invalid handler configuration through diagnostics", async () => {
    const reportDiagnostic = jest.fn();
    await createPixelModule().handle!(
      { effectName: "pixel", effect: { on: [] }, step: {}, payload: {} },
      { reportDiagnostic } as any,
    );
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "pixel_missing_params", level: "error" }),
    );
  });

  it("reports missing snippets and target elements", async () => {
    const reportDiagnostic = jest.fn();
    const handle = createPixelModule().handle!;
    const api = { reportDiagnostic } as any;
    await handle(
      { effectName: "pixel", effect: { on: [] }, step: { params: {} }, payload: {} },
      api,
    );
    await handle(
      {
        effectName: "pixel",
        effect: { on: [] },
        step: { params: { snippet: "<img>", selector: "#missing" } },
        payload: {},
      },
      api,
    );
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "pixel_missing_snippet" }),
    );
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "pixel_element_not_found" }),
    );
  });

  it("interpolates payload values and appends script and HTML nodes", async () => {
    document.body.innerHTML = '<div id="target"></div>';
    await createPixelModule().handle!(
      {
        effectName: "pixel",
        effect: { on: [] },
        step: {
          params: {
            selector: "#target",
            snippet:
              '<script data-id="{{ payload.id }}">window.pixel = true</script><img alt="{{ payload.label }}">',
          },
        },
        payload: { id: "123", label: "Checkout" },
      },
      { reportDiagnostic: jest.fn() } as any,
    );
    const target = document.querySelector("#target")!;
    expect(target.querySelector("script")?.getAttribute("data-id")).toBe("123");
    expect(target.querySelector("script")?.textContent).toContain("window.pixel");
    expect(target.querySelector("img")?.getAttribute("alt")).toBe("Checkout");
  });
});
