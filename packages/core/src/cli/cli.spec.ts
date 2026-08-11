import { runCLI } from "./cli";

describe("runCLI help", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it("lists built in commands outside an Eventvisor project", async () => {
    process.argv = ["node", "eventvisor", "--help"];
    const output = jest.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(runCLI({ rootDirectoryPath: "/tmp/not-an-eventvisor-project" })).resolves.toBe(0);
    const text = output.mock.calls.flat().join(" ");
    expect(text).toContain("build");
    expect(text).toContain("catalog");
    expect(text).toContain("init");
  });

  it("shows project command help without loading a project", async () => {
    process.argv = ["node", "eventvisor", "build", "--help"];
    await expect(runCLI({ rootDirectoryPath: "/tmp/not-an-eventvisor-project" })).resolves.toBe(0);
  });

  it("declares documented config output options", async () => {
    process.argv = ["node", "eventvisor", "config", "--help"];
    const output = jest.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(runCLI({ rootDirectoryPath: "/tmp/not-an-eventvisor-project" })).resolves.toBe(0);
    const text = output.mock.calls.flat().join(" ");
    expect(text).toContain("--json");
    expect(text).toContain("--pretty");
  });

  it("reports a useful error when executing a project command outside a project", async () => {
    process.argv = ["node", "eventvisor", "build"];
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runCLI({ rootDirectoryPath: "/tmp/not-an-eventvisor-project" })).resolves.toBe(1);
    expect(error.mock.calls.flat().join(" ")).toContain("No Eventvisor project found");
  });

  it("accepts required positional arguments with strict option parsing", async () => {
    process.argv = ["node", "eventvisor", "benchmark", "page_view"];
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runCLI({ rootDirectoryPath: "/tmp/not-an-eventvisor-project" })).resolves.toBe(1);
    const text = error.mock.calls.flat().join(" ");
    expect(text).toContain("No Eventvisor project found");
    expect(text).not.toContain("Unknown argument");
  });
});
