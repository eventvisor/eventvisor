module.exports = {
  bail: true,
  roots: ["<rootDir>/src"],
  transform: require("../../jest.swc-transform.cjs"),
  coverageThreshold: {
    global: { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
};
