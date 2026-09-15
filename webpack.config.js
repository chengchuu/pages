const path = require("node:path");
const fs = require("node:fs/promises");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const discoverPages = require("./scripts/discover-pages");
const resolveAssets = require("./config/resolve-external-assets");
const ExternalAssetsPlugin = require("./config/ExternalAssetsPlugin");

function createConfig(root, mode = "production", serving = false) {
  if (![ "development", "production" ].includes(mode)) throw new Error(`Unsupported Webpack mode: ${mode}`);
  const sharedFile = path.join(root, "config/external-assets.config.js");
  const shared = require(sharedFile);
  const pages = discoverPages(path.join(root, "src/pages"));
  const outputDirectory = path.join(root, "dist");
  // Remove obsolete outputs once; each compiler cleans only its own page directory.
  let preparation;
  const prepare = () => {
    preparation ||= (async () => {
      await fs.mkdir(outputDirectory, { recursive: true });
      const entries = await fs.readdir(outputDirectory);
      await Promise.all(entries.filter((name) => !pages.some((page) => page.name === name))
        .map((name) => fs.rm(path.join(outputDirectory, name), { recursive: true, force: true })));
    })();
    return preparation;
  };
  return pages.map((page, pageIndex) => {
    const assets = new Map([ [ "index.html", resolveAssets(shared, page.config, mode, sharedFile, page.configFile) ] ]);
    const html = new HtmlWebpackPlugin({
      filename: "index.html",
      template: `${require.resolve("./config/html-source-loader")}!${page.template}`,
      chunks: [ ...(serving ? [ "dev-client" ] : []), ...(page.entry ? [ "index" ] : []) ],
      chunksSortMode: "manual",
      inject: "head",
      scriptLoading: "defer",
      minify: false,
    });
    return {
      name: page.name,
      mode,
      context: root,
      // HtmlWebpackPlugin owns HTML output; disable Webpack's native HTML transforms.
      experiments: { html: false },
      entry: {
        ...(page.entry ? { index: page.entry } : {}),
        // Each served page includes a functional reload client, including HTML-only pages.
        ...(serving ? { "dev-client": `${require.resolve("webpack-dev-server/client/index.js")}?hostname=0.0.0.0&port=0&pathname=/ws&hot=false&live-reload=true` } : {}),
      },
      output: {
        path: path.join(outputDirectory, page.name),
        filename: mode === "production" ? "[name].[contenthash:8].js" : "[name].js",
        chunkFilename: mode === "production" ? "chunks/[name].[contenthash:8].js" : "chunks/[name].js",
        assetModuleFilename: "assets/[name].[contenthash:8][ext]",
        publicPath: serving ? `/${encodeURIComponent(page.name)}/` : "auto",
        clean: true,
      },
      optimization: { splitChunks: false, runtimeChunk: false },
      plugins: [
        {
          apply(compiler) {
            compiler.hooks.beforeRun.tapPromise("PreparePagesOutput", prepare);
            compiler.hooks.watchRun.tapPromise("PreparePagesOutput", prepare);
          },
        },
        html,
        new ExternalAssetsPlugin(assets),
      ],
      // One server serves all page compilers on the same port.
      devServer: pageIndex === 0 ? {
        host: "127.0.0.1",
        port: 4130,
        static: false,
        historyApiFallback: false,
        hot: false,
        client: false,
        liveReload: true,
        watchFiles: [ path.join(root, "src/pages/**/*.html") ],
        onListening(server) {
          const address = server.server.address();
          const host = address.address.includes(":") ? `[${address.address}]` : address.address;
          const protocol = server.options.server.type === "http" ? "http" : "https";
          server.logger.info("Available pages:");
          for (const page of pages) {
            server.logger.info(`${protocol}://${host}:${address.port}/${encodeURIComponent(page.name)}/`);
          }
        },
      } : undefined,
    };
  });
}

module.exports = (environment, argv) => createConfig(__dirname, argv.mode, environment.WEBPACK_SERVE === true);
module.exports.createConfig = createConfig;
