module.exports = {
  transform: require("../../jest.swc-transform.cjs"),
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  bail: true,
  collectCoverageFrom: ["src/**/*.ts"],
};
