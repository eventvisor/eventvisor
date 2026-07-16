module.exports = {
  bail: true,
  roots: ["<rootDir>/src"],
  transform: require("../../jest.swc-transform.cjs"),
  coverageThreshold: {
    global: { statements: 60, branches: 45, functions: 60, lines: 60 },
  },
};
