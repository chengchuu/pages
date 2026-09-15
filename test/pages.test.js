const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const generate = require("../scripts/generate-pages-index");
const validate = require("../scripts/validate-pages");
const palette = require("../config/pages-palette");

async function write(root, file, contents) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), contents);
}

async function fixture(t, names = [ "example", "simple" ]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pages-directory-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const name of names) {
    await write(root, `src/pages/${name}/index.html`, "<h1>Demo</h1>");
    await write(root, `dist/${name}/index.html`, "<h1>Demo</h1>");
  }
  await generate(root);
  return root;
}

test("directory generation is deterministic, escaped, and updates with discovery", async (t) => {
  const root = await fixture(t, [ "z", "100% & 'demo'" ]);
  const file = path.join(root, "dist/index.html");
  const original = await fs.readFile(file, "utf8");
  assert.match(original, /href="\.\/100%25%20%26%20&#39;demo&#39;\/"/);
  assert.match(original, />100% &amp; &#39;demo&#39;<\/a>/);
  assert.ok(original.indexOf("100%25") < original.indexOf("./z/"));
  await validate(root);
  await generate(root);
  assert.equal(await fs.readFile(file, "utf8"), original);
  await write(root, "src/pages/new/index.html", "<h1>New</h1>");
  await assert.rejects(generate(root), /new.*index.html/);
  await write(root, "dist/new/index.html", "<h1>New</h1>");
  await fs.rm(path.join(root, "src/pages/z"), { recursive: true });
  await fs.rm(path.join(root, "dist/z"), { recursive: true });
  await generate(root);
  assert.doesNotMatch(await fs.readFile(file, "utf8"), /href=".\/z\/"/);
  await validate(root);
});

test("validator rejects missing, duplicate, and stale directory entries", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "dist/index.html");
  const html = await fs.readFile(file, "utf8");
  for (const replacement of [ "", "<a href=\"./example/\">Again</a>", "<a href=\"./stale/\">Stale</a>" ]) {
    await write(root, "dist/stale/index.html", "stale");
    await fs.writeFile(file, html.replace("<a href=\"./simple/\">simple</a>", replacement));
    await assert.rejects(validate(root), /directory.*missing, duplicate, or stale/);
  }
  await fs.rm(file);
  await assert.rejects(validate(root), /index.html/);
});

test("validator resolves supported local references and skips external and raw-text content", async (t) => {
  const root = await fixture(t);
  await write(root, "dist/simple/site.css", "body {}");
  await write(root, "dist/simple/icon.svg", "<svg/>");
  await write(root, "dist/simple/helper.js", "");
  await write(root, "dist/simple/index.html", `
    <a href='../example/?a=1&amp;b=2#section'>Example</a>
    <a href="#section">Section</a><a href="mailto:test@example.test">Mail</a>
    <a href="https://external.test/">External</a>
    <link rel="stylesheet" href="site.css"><img src=icon.svg>
    <script src="helper.js"></script>
    <script>const text = '<img src="missing">';</script>
    <!-- <img src="missing"> -->
    <textarea><img src="missing"></textarea>
  `);
  await validate(root);
  for (const ref of [ "missing.svg", "/outside.svg", "../../outside.svg", "%zz", "%2e%2e%2f%2e%2e%2foutside", "%5coutside" ]) {
    await write(root, "dist/simple/index.html", `<img src="${ref}">`);
    await assert.rejects(validate(root), /simple\/index.html:/);
  }
  await write(root, "dist/simple/index.html", "<base href=\"/\"><img src=\"icon.svg\">");
  await assert.rejects(validate(root), /base elements/);
});

test("validator rejects symlink escapes and unwanted bundles", async (t) => {
  const root = await fixture(t);
  await write(root, "outside.svg", "<svg/>");
  await fs.symlink(path.join(root, "outside.svg"), path.join(root, "dist/simple/escape.svg"));
  await write(root, "dist/simple/index.html", "<img src=\"escape.svg\">");
  await assert.rejects(validate(root), /Symlink escapes/);
  await write(root, "dist/simple/index.html", "<h1>Simple</h1>");
  for (const name of [ "index.1234abcd.js", "dev-client.js" ]) {
    await write(root, `dist/simple/${name}`, "");
    await assert.rejects(validate(root), /unexpected HTML-only|development client/);
    await fs.rm(path.join(root, "dist/simple", name));
  }
  await write(root, "src/pages/simple/index.js", "");
  await write(root, "dist/simple/index.1234abcd.js", "");
  await validate(root);
});

test("validator decodes numeric reference entities and stylesheet rel tokens", async (t) => {
  const root = await fixture(t);
  await write(root, "dist/simple/icon.svg", "<svg/>");
  await write(root, "dist/simple/index.html", "<img src=\"icon&#46svg\">");
  await validate(root);
  await write(root, "dist/simple/index.html", "<link rel=\"style&#115;heet\" href=\"missing.css\">");
  await assert.rejects(validate(root), /simple\/index.html:.*missing.css/);
  await write(root, "dist/simple/site.css", "");
  await write(root, "dist/simple/index.html", "<link rel=\"style&#115heet\" href=\"site.css\">");
  await validate(root);
});

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

test("landing page has accessible static light presentation without scripts", async (t) => {
  const root = await fixture(t);
  const html = await fs.readFile(path.join(root, "dist/index.html"), "utf8");
  assert.match(html, /<html lang="en" data-theme="light">/);
  assert.match(html, /name="theme-color" content="#ffffff"/);
  assert.match(html, /<title>Pages demos<\/title>/);
  assert.match(html, /<h1>Pages demos<\/h1>/);
  const favicons = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) || [];
  assert.equal(favicons.length, 1);
  assert.ok(favicons[0].includes("href=\"https://i.mazey.net/icon/fav/logo-dark-circle-transparent-32x32.png\""));
  assert.ok(favicons[0].includes("type=\"image/png\""));
  assert.ok(favicons[0].includes("sizes=\"32x32\""));
  assert.match(html, /color-scheme: light/);
  assert.doesNotMatch(html, /<script|prefers-color-scheme|data-theme="dark"/);
  for (const [ name, [ light ] ] of Object.entries(palette)) assert.ok(html.includes(`--color-${name}: ${light};`));
  for (const color of [ "#2f73df", palette.heading[0], palette.body[0] ]) {
    assert.ok((luminance("#ffffff") + 0.05) / (luminance(color) + 0.05) >= 4.5);
  }
  assert.match(html, /a:focus-visible\s*{\s*outline: 2px solid var\(--color-link-text\);\s*outline-offset: 4px;/);
  assert.match(html, /a:hover\s*{ text-decoration-thickness:/);
  assert.match(html, /::selection\s*{\s*background: var\(--color-highlight\)/);
});

test("Pages workflow preserves approved triggers, validation order, permissions, and actions", async () => {
  const workflow = await fs.readFile(path.join(__dirname, "../.github/workflows/pages.yml"), "utf8");
  assert.match(workflow, /push:\n {4}branches: \[main\]\n {2}workflow_dispatch:/);
  const steps = [ ...workflow.matchAll(/- (?:uses|run): (.+)/g) ].map((match) => match[1]);
  assert.deepEqual(steps, [
    "actions/checkout@v7", "actions/setup-node@v6", "npm install", "npm run lint",
    "npm run test", "npm run build:dev", "npm run build:pages", "npm run validate:pages",
    "actions/configure-pages@v6", "actions/upload-pages-artifact@v5",
  ]);
  assert.match(workflow, /uses: actions\/deploy-pages@v5/);
  assert.match(workflow, /node-version: 22\n {10}package-manager-cache: false/);
  assert.match(workflow, /permissions:\n {2}contents: read/);
  assert.match(workflow, /deploy:\n {4}needs: build/);
  assert.match(workflow, /permissions:\n {6}pages: write\n {6}id-token: write/);
  assert.match(workflow, /name: github-pages/);
  assert.ok(workflow.includes("steps.deployment.outputs.page_url"));
  assert.match(workflow, /group: pages\n {2}cancel-in-progress: false/);
  assert.match(workflow, /path: dist\//);
  assert.doesNotMatch(workflow, /npm ci|actions\/cache|\n\s+cache:|cache-dependency-path|Corepack|NPM_TOKEN/);
});
