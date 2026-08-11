module.exports = {
  bail: true,
  roots: ["<rootDir>/src"],
  transform: require("../../jest.swc-transform.cjs"),
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@eventvisor/sdk/portable$": "<rootDir>/../sdk/src/portable.ts",
    "^@eventvisor/sdk/validator$": "<rootDir>/../sdk/src/validator.ts",
  },
  coverageThreshold: {
    global: { statements: 60, branches: 45, functions: 60, lines: 60 },
  },
};
