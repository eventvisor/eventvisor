module.exports = {
  preset: "ts-jest",
  bail: true,
  testEnvironment: "jsdom",
  collectCoverageFrom: ["src/**/*.ts"],
};
