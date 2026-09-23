const HtmlWebpackPlugin = require("html-webpack-plugin");

// HtmlWebpackPlugin's tag serializer does not escape attribute strings.
function escapeAttributes(attributes) {
  return Object.fromEntries(Object.entries(attributes).map(([ key, value ]) => [
    key,
    typeof value === "string"
      ? value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      : value,
  ]));
}

module.exports = class ExternalAssetsPlugin {
  constructor(assetsByOutput, favicon) {
    this.assetsByOutput = assetsByOutput;
    this.favicon = favicon;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("ExternalAssetsPlugin", (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap("ExternalAssetsPlugin", (data) => {
        const assets = this.assetsByOutput.get(data.outputName);
        const styles = assets.styles.map((attributes) => HtmlWebpackPlugin.createHtmlTagObject(
          "link", escapeAttributes({ rel: "stylesheet", ...attributes }),
        ));
        const scripts = assets.scripts.map((attributes) => HtmlWebpackPlugin.createHtmlTagObject(
          "script", escapeAttributes(attributes),
        ));
        const favicon = HtmlWebpackPlugin.createHtmlTagObject(
          "link", escapeAttributes({ rel: "icon", ...this.favicon }),
        );
        data.headTags = [ favicon, ...styles, ...scripts, ...data.headTags ];
        return data;
      });
    });
  }
};
