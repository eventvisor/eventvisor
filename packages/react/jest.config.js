module.exports = {
  transform: require("../../jest.swc-transform.cjs"),
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  bail: true,

  // for react testing library
  testEnvironment: "jsdom",
  setupFilesAfterEnv: [
    // "@testing-library/jest-dom/extend-expect",
    "./jest.setup.js",
  ],
};
