module.exports = {
  roots: ["<rootDir>/src"],
  transform: require("../../jest.swc-transform.cjs"),
  collectCoverageFrom: [
    "src/api.ts",
    "src/conditionModel.ts",
    "src/definitionModel.ts",
    "src/entityTypes.ts",
    "src/historyModel.ts",
    "src/listSearch.ts",
    "src/transformModel.ts",
  ],
  coverageThreshold: {
    global: { statements: 75, branches: 70, functions: 75, lines: 75 },
  },
};
