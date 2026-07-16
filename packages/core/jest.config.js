module.exports = {
  bail: true,
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.cjs.json" }],
  },
  coverageThreshold: {
    global: { statements: 60, branches: 45, functions: 60, lines: 60 },
  },
};
