module.exports = {
  "^.+\\.[tj]sx?$": [
    "@swc/jest",
    {
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        transform: { react: { runtime: "automatic" } },
      },
      module: { type: "commonjs" },
    },
  ],
};
