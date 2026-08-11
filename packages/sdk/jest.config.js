module.exports = {
  transform: require("../../jest.swc-transform.cjs"),
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  bail: true,
  collectCoverageFrom: ["src/**/*.ts"],
  coveragePathIgnorePatterns: ["src/index.ts", "src/murmurhash.ts", "src/compareVersions.ts"],
  coverageThreshold: {
    global: { statements: 80, branches: 75, functions: 80, lines: 80 },
  },
};
