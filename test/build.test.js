const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const webpack = require("webpack");
const { createConfig } = require("../webpack.config");
const discover = require("../scripts/discover-pages");
const resolveAssets = require("../config/resolve-external-assets");
const generatePagesIndex = require("../scripts/generate-pages-index");
const validatePages = require("../scripts/validate-pages");

const document = "<!doctype html><html><head><title>Fixture</title></head><body><!-- keep --><h1>Fixture &amp; content</h1></body></html>";

function assertFavicon(html) {
  const tags = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) || [];
  assert.equal(tags.length, 1);
  assert.ok(tags[0].includes("href=\"https://i.mazey.net/icon/fav/logo-dark-circle-transparent-32x32.png\""));
  assert.ok(tags[0].includes("type=\"image/png\""));
  assert.ok(tags[0].includes("sizes=\"32x32\""));
}

async function write(root, filename, content) {
  const file = path.join(root, filename);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function fixture(t, shared = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pages-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await write(root, "config/external-assets.config.js", `module.exports = ${JSON.stringify(shared)};`);
  return root;
}

function build(root, mode, pageName, serving = false) {
  return new Promise((resolve, reject) => {
    const configs = createConfig(root, mode, serving);
    const compiler = webpack(pageName ? configs.filter((config) => config.name === pageName) : configs);
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError) return reject(error || closeError);
        if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
        resolve({
          assets: stats.stats.flatMap((page) => page.toJson({ all: false, assets: true }).assets.map((asset) => ({ ...asset, name: `${page.compilation.name}/${asset.name}` }))),
          fileDependencies: stats.stats.flatMap((page) => [ ...page.compilation.fileDependencies ]),
        });
      });
    });
  });
}

for (const mode of [ "development", "production" ]) {
  test(`${mode}: shared lazy modules and emitted assets stay inside each page`, async (t) => {
    const root = await fixture(t);
    await write(root, "src/shared/lazy.js", "export default 'lazy value';");
    for (const name of [ "first", "second" ]) {
      await write(root, `src/pages/${name}/index.html`, document);
      await write(root, `src/pages/${name}/icon.svg`, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
      await write(root, `src/pages/${name}/index.js`, "globalThis.icon = new URL('./icon.svg', import.meta.url); import('../../shared/lazy.js').then(module => { globalThis.lazy = module.default; });");
    }
    const stats = await build(root, mode);
    for (const name of [ "first", "second" ]) {
      const localAssets = stats.assets.filter((asset) => asset.name.startsWith(`${name}/`));
      assert.ok(localAssets.some((asset) => asset.name.startsWith(`${name}/chunks/`) && asset.name.endsWith(".js")));
      assert.ok(localAssets.some((asset) => asset.name.startsWith(`${name}/assets/`) && asset.name.endsWith(".svg")));
      const html = await fs.readFile(path.join(root, "dist", name, "index.html"), "utf8");
      assertFavicon(html);
      assert.doesNotMatch(html, /(?:src|href)="\.\.\//);
    }
    assert.deepEqual((await fs.readdir(path.join(root, "dist"))).sort(), [ "first", "second" ]);
    const secondHtml = await fs.readFile(path.join(root, "dist/second/index.html"), "utf8");
    await build(root, mode, "first");
    assert.equal(await fs.readFile(path.join(root, "dist/second/index.html"), "utf8"), secondHtml);
  });

  test(`${mode}: literal template syntax in source HTML stays unchanged`, async (t) => {
    const root = await fixture(t);
    const literal = "<script type=\"text/plain\"><%= clientTemplate %> ${value}</script>";
    await write(root, "src/pages/literal/index.html", document.replace("</body>", `${literal}</body>`));
    const stats = await build(root, mode);
    assert.ok(stats.fileDependencies.includes(path.join(root, "src/pages/literal/index.html")));
    const html = await fs.readFile(path.join(root, "dist/literal/index.html"), "utf8");
    assert.ok(html.includes(literal));
  });

  test(`${mode}: all page combinations and additive external assets`, async (t) => {
    const shared = Object.fromEntries([ "development", "production" ].map((environment) => [ environment, {
      styles: [ { href: `https://example.test/${environment}.css?x=1&y=2`, media: "screen and (width > 1px) \"quoted\"" } ],
      scripts: [ { src: `https://example.test/${environment}.js`, defer: true, async: false } ],
    } ]));
    const root = await fixture(t, shared);
    for (const name of [ "html", "js", "config", "full" ]) {
      await write(root, `src/pages/${name}/index.html`, document);
      if ([ "js", "full" ].includes(name)) await write(root, `src/pages/${name}/index.js`, `globalThis.fixture = "${name}";`);
      if ([ "config", "full" ].includes(name)) await write(root, `src/pages/${name}/page.config.js`, `module.exports = ${JSON.stringify({ externalAssets: {
        [mode]: { styles: [ { href: "//example.test/page.css", integrity: "sha384-test", crossorigin: "anonymous", referrerpolicy: "no-referrer" } ], scripts: [ { src: "//example.test/page.js", type: "module", async: true } ] },
      } })};`);
    }
    await write(root, "src/pages/ignored/readme.txt", "not a page");
    assert.deepEqual(discover(path.join(root, "src/pages")).map((page) => page.name), [ "config", "full", "html", "js" ]);
    const stats = await build(root, mode);
    assert.equal(stats.assets.filter((asset) => asset.name.endsWith(".js")).length, 2);
    for (const name of [ "html", "js", "config", "full" ]) {
      const html = await fs.readFile(path.join(root, "dist", name, "index.html"), "utf8");
      assert.ok(html.includes("<!-- keep -->"));
      assert.ok(html.includes("<h1>Fixture &amp; content</h1>"));
      assert.ok(html.includes(`${mode}.css?x=1&amp;y=2`));
      assert.ok(html.includes("&quot;quoted&quot;"));
      assert.ok(html.includes("width &gt; 1px"));
      assert.doesNotMatch(html, /async="false"/);
      assert.ok(html.indexOf(`${mode}.css`) < html.indexOf("</head>"));
      assert.ok(html.includes(`src="https://example.test/${mode}.js" defer`));
      const bundles = [ ...html.matchAll(/src="(index(?:\.[a-f0-9]+)?\.js)"/g) ];
      assert.equal(bundles.length, [ "js", "full" ].includes(name) ? 1 : 0);
      for (const [ , url ] of bundles) {
        assert.match(url, mode === "production" ? /^index\.[a-f0-9]{8}\.js$/ : /^index\.js$/);
        const bundle = await fs.readFile(path.resolve(root, "dist", name, url), "utf8");
        const context = {};
        vm.runInNewContext(bundle, context);
        assert.equal(context.fixture, name);
        assert.ok(html.indexOf(`${mode}.js`) < html.indexOf(url));
      }
      if ([ "config", "full" ].includes(name)) {
        assert.ok(html.indexOf(`${mode}.css`) < html.indexOf("page.css"));
        assert.ok(html.indexOf(`${mode}.js`) < html.indexOf("page.js"));
        assert.ok(html.includes("type=\"module\" async"));
        if (bundles.length) assert.ok(html.indexOf("page.js") < html.indexOf(bundles[0][1]));
      }
    }
  });

  test(`${mode}: HTML-only build and deleted page cleanup`, async (t) => {
    const root = await fixture(t);
    await write(root, "src/pages/first/index.html", document);
    await write(root, "src/pages/second/index.html", document);
    const stats = await build(root, mode);
    assert.equal(stats.assets.filter((asset) => asset.name.endsWith(".js")).length, 0);
    assert.doesNotMatch(await fs.readFile(path.join(root, "dist/first/index.html"), "utf8"), /<script/);
    await generatePagesIndex(root);
    await validatePages(root);
    await fs.rm(path.join(root, "src/pages/second"), { recursive: true });
    await build(root, mode);
    await assert.rejects(fs.stat(path.join(root, "dist/second/index.html")), { code: "ENOENT" });
    await assert.rejects(fs.stat(path.join(root, "dist/index.html")), { code: "ENOENT" });
    await generatePagesIndex(root);
    await validatePages(root);
  });
}

test("configuration boundaries", () => {
  const resolve = (shared, page, mode = "production") => resolveAssets(shared, page, mode, "shared.js", "page.config.js");
  assert.deepEqual(resolve({}, {}), { styles: [], scripts: [] });
  assert.deepEqual(resolve({}, { externalAssets: { production: { scripts: [ { src: "/only.js" } ] } } }).scripts, [ { src: "/only.js" } ]);
  for (const invalid of [ null, [], "bad", { unknown: {} }, { production: null }, { production: { scripts: "bad" } }, { production: { scripts: [ "bad" ] } }, { production: { styles: [ { href: " " } ] } }, { production: { scripts: [ { src: "a", defer: "false" } ] } }, { production: { styles: [ { href: "a", onclick: "bad" } ] } } ]) {
    assert.throws(() => resolve(invalid, {}), /shared\.js/);
  }
  assert.throws(() => resolve({}, { title: "unsupported" }), /page.config.js.title/);
  assert.throws(() => resolve({}, { externalAssets: null }), /page.config.js.externalAssets/);
  assert.throws(() => resolve({}, {}, "none"), /Unsupported Webpack mode/);
});

test("sparse asset arrays fail at the configuration boundary with a field path", () => {
  for (const kind of [ "styles", "scripts" ]) {
    const externalAssets = { production: { [kind]: new Array(1) } };
    const suffix = `production.${kind}[0] must be an object`;
    assert.throws(
      () => resolveAssets(externalAssets, {}, "production", "shared.js", "page.config.js"),
      { message: `shared.js.${suffix}` },
    );
    assert.throws(
      () => resolveAssets({}, { externalAssets }, "production", "shared.js", "page.config.js"),
      { message: `page.config.js.externalAssets.${suffix}` },
    );
  }
});

test("missing optional files are normal; zero pages fail clearly", async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, "src/pages"), { recursive: true });
  assert.throws(() => createConfig(root), /No pages/);
  await write(root, "src/pages/only/index.html", document);
  assert.equal(createConfig(root)[0].mode, "production");
  await fs.mkdir(path.join(root, "src/pages/only/index.js"));
  assert.throws(() => createConfig(root), /index.js must be a file/);
});

test("repository Link page is HTML-only and consumes sibling assets", async () => {
  const root = path.resolve(__dirname, "..");
  const page = discover(path.join(root, "src/pages")).find(({ name }) => name === "link");
  assert.ok(page);
  assert.equal(page.entry, null);
  assert.deepEqual(page.config.externalAssets, {
    development: {
      styles: [ { href: "http://127.0.0.1:4132/link.css" } ],
      scripts: [ { src: "http://127.0.0.1:4131/link.js", defer: true } ],
    },
    production: {
      styles: [ { href: "https://i.mazey.net/style/lib/link.css" } ],
      scripts: [ { src: "https://i.mazey.net/polestar/lib/link.js", defer: true } ],
    },
  });
  const html = await fs.readFile(page.template, "utf8");
  assert.match(html, /id="tiny-box"/);
  assert.match(html, /window\.TINY_FOREIGN_BASE_URL/);
});

test("repository Base page is HTML-only and consumes the sibling stylesheet", async () => {
  const root = path.resolve(__dirname, "..");
  const page = discover(path.join(root, "src/pages")).find(({ name }) => name === "base");
  assert.ok(page);
  assert.equal(page.entry, null);
  assert.deepEqual(page.config.externalAssets, {
    development: {
      styles: [ { href: "http://127.0.0.1:4132/base.css" } ],
    },
    production: {
      styles: [ { href: "https://i.mazey.net/style/lib/base.css" } ],
    },
  });
  const html = await fs.readFile(page.template, "utf8");
  assert.match(html, /<main class="base base-accent base-info">/);
  assert.doesNotMatch(html, /<script\b/);
});

test("served page bundle URLs encode special characters in page names", async (t) => {
  const root = await fixture(t);
  const name = "100% done";
  await write(root, `src/pages/${name}/index.html`, document);
  await write(root, `src/pages/${name}/index.js`, "globalThis.fixture = true;");
  await build(root, "development", undefined, true);
  const html = await fs.readFile(path.join(root, "dist", name, "index.html"), "utf8");
  assertFavicon(html);
  const urls = [ ...html.matchAll(/src="([^"]+)"/g) ].map((match) => match[1]);
  assert.deepEqual(urls, [ "/100%25%20done/dev-client.js", "/100%25%20done/index.js" ]);
  for (const url of urls) {
    await fs.access(path.join(root, "dist", decodeURIComponent(url)));
  }
});

test("startup URLs use discovered pages and the listening address", async (t) => {
  const root = await fixture(t);
  for (const name of [ "z page", "example" ]) await write(root, `src/pages/${name}/index.html`, document);
  const configs = createConfig(root, "development", true);
  assert.equal(configs.filter((config) => config.devServer).length, 1);
  assert.equal(configs[0].devServer.host, "127.0.0.1");
  assert.equal(configs[0].devServer.port, 4130);
  for (const [ address, type, origin ] of [
    [ { address: "127.0.0.1", port: 9123 }, "http", "http://127.0.0.1:9123" ],
    [ { address: "::1", port: 9443 }, "https", "https://[::1]:9443" ],
  ]) {
    const messages = [];
    configs[0].devServer.onListening({
      server: { address: () => address },
      options: { server: { type } },
      logger: { info: (message) => messages.push(message) },
    });
    assert.deepEqual(messages, [ "Available pages:", `${origin}/example/`, `${origin}/z%20page/` ]);
  }
});
