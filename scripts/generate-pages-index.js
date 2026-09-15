const fs = require("node:fs/promises");
const path = require("node:path");
const discover = require("./discover-pages");
const palette = require("../config/pages-palette");
const siteConfig = require("../config/site.config");

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

async function generatePagesIndex(root) {
  const pages = discover(path.join(root, "src/pages"));
  for (const page of pages) {
    const destination = path.join(root, "dist", page.name, "index.html");
    if (!(await fs.stat(destination)).isFile()) throw new Error(`${destination} must be a file`);
  }
  const css = await fs.readFile(path.join(__dirname, "../config/pages-index.css"), "utf8");
  const tokens = Object.entries(palette).map(([ name, [ light ] ]) => `  --color-${name}: ${light};`).join("\n");
  const links = pages.map(({ name }) => `    <li><a href="./${escapeHtml(encodeURIComponent(name))}/">${escapeHtml(name)}</a></li>`).join("\n");
  const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${palette.surface[0]}">
  <link rel="icon" href="${escapeHtml(siteConfig.favicon.href)}" type="${escapeHtml(siteConfig.favicon.type)}" sizes="${escapeHtml(siteConfig.favicon.sizes)}">
  <title>Pages demos</title>
  <style>
:root {
${tokens}
}
${css}</style>
</head>
<body>
  <main>
    <h1>Pages demos</h1>
    <p>Explore independent demos built with a shared Webpack build system.</p>
    <ul>
${links}
    </ul>
  </main>
</body>
</html>
`;
  await fs.writeFile(path.join(root, "dist/index.html"), html);
}

module.exports = generatePagesIndex;
if (require.main === module) {
  generatePagesIndex(path.join(__dirname, "..")).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
