import {
  CLI_COLOR_CYAN,
  CLI_FORMAT_BOLD,
  CLI_FORMAT_GREEN,
  CLI_FORMAT_RED,
  colorize,
} from "./cliFormat";

describe("CLI formatting", () => {
  it("uses the same ANSI presentation primitives as the Featurevisor CLI", () => {
    expect(CLI_FORMAT_RED).toBe("\x1b[31m%s\x1b[0m");
    expect(CLI_FORMAT_GREEN).toBe("\x1b[32m%s\x1b[0m");
    expect(CLI_FORMAT_BOLD).toBe("\x1b[1m%s\x1b[0m");
    expect(colorize("Event", CLI_COLOR_CYAN)).toBe("\x1b[36mEvent\x1b[0m");
  });
});
