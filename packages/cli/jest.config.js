module.exports = {
  bail: true,
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.cjs.json" }],
  },
};
