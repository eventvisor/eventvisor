module.exports = {
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { module: "CommonJS", jsx: "react-jsx", esModuleInterop: true } },
    ],
  },
};
