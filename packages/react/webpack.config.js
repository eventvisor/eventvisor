const path = require("path");

const externals = {
  react: {
    commonjs: "react",
    commonjs2: "react",
    amd: "react",
    root: "React",
  },
};

module.exports = [
  // cjs
  {
    entry: {
      "index.cjs": path.join(__dirname, "src", "index.tsx"),
    },
    output: {
      path: path.join(__dirname, "dist"),
      filename: "index.js",
      library: "EventvisorReactSDK",
      libraryTarget: "umd",
      globalObject: "this",
    },
    mode: "production",
    devtool: "source-map",
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    externals,
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /(node_modules)/,
          use: [
            {
              loader: "ts-loader",
              options: {
                configFile: path.join(__dirname, "tsconfig.cjs.json"),
                transpileOnly: true,
              },
            },
          ],
        },
      ],
    },
    performance: {
      hints: false,
    },
    optimization: {
      minimize: true,
    },
  },

  // esm
  {
    entry: path.join(__dirname, "src", "index.tsx"),
    output: {
      path: path.join(__dirname, "dist"),
      filename: "index.mjs",
      library: {
        type: "module",
      },
    },
    experiments: {
      outputModule: true,
    },
    mode: "production",
    devtool: "source-map",
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    externals,
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /(node_modules)/,
          loader: "ts-loader",
          options: {
            configFile: path.join(__dirname, "tsconfig.esm.json"),
          },
        },
      ],
    },
    performance: {
      hints: false,
    },
  },
];
