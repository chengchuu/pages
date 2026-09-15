# Pages

Independent HTML pages built with Webpack 5. Pages are discovered from immediate directories under `src/pages/`; only `index.html` is required.

Live Demo deployment target: <https://chengchuu.github.io/pages/>.

## Install and run

Use Node.js 22 or newer and independently installed pnpm.

```bash
pnpm install
npm run dev
```

Open <http://127.0.0.1:4130/simple/> for the HTML-only example or <http://127.0.0.1:4130/example/> for the counter example. There is no root landing page or SPA fallback.

| Command                  | Purpose                                           |
| :----------------------- | :------------------------------------------------ |
| `npm run dev`            | Start the development server                      |
| `npm run build:dev`      | Write a development build to `dist/`              |
| `npm run build`          | Write a production build to `dist/`               |
| `npm run build:pages`    | Build demos and generate the Pages directory      |
| `npm run validate:pages` | Check the existing Pages artifact                 |
| `npm run lint`           | Check JavaScript source, configuration, and tests |
| `npm run lint:fix`       | Apply ESLint fixes                                |
| `npm run test`           | Run Node tests with temporary build fixtures      |

Use pnpm for dependency installation, additions, updates, and removals. Track `pnpm-lock.yaml`; keep `package-lock.json` untracked. Use `pnpm install --frozen-lockfile` to verify the recorded resolution. Use npm for project scripts and `npm pack` for package inspection. GitHub Actions uses `npm install` and npm scripts without npm dependency caching or `npm ci`; npm does not consume the pnpm lockfile.

### Develop the Link page

The Link page keeps its HTML, JavaScript, and CSS in separate projects. Start all three development servers:

```bash
# pages
npm run dev

# mazey-polestar
npm run dev:link

# mazey.css
npm run dev:link
```

Open <http://127.0.0.1:4130/link/>. The page loads `link.js` from port `4131` and `link.css` from port `4132`. Refresh the page manually after CSS changes.

## GitHub Pages

`npm run build:pages` runs the production build, then generates `dist/index.html` from discovered demos. It links to each independent page with relative URLs. The landing page has a static light theme, inline semantic colors, and no JavaScript. Its template belongs to `scripts/generate-pages-index.js`; CSS and the supplied palette pairs belong to `config/pages-index.css` and `config/pages-palette.js`. Only light palette values are emitted.

Ordinary builds can remove this root document. Use `build:pages` to recreate the complete deployment artifact; the development server still has no root directory page.

`npm run validate:pages` checks the existing artifact under the `/pages/` mount path without rebuilding. It checks discovered directory links, anchor destinations, script sources, stylesheet links, and image sources. Local destinations must exist within the artifact; external and non-file URLs are not fetched. Base elements are unsupported. The bounded HTML inspection handles quoted/unquoted attributes, common or numeric reference entities, and skips comments and raw-text contents. It is not a general HTML conformance checker and does not inspect CSS URLs, `srcset`, or runtime-created URLs.

The workflow builds and validates on pushes to `main` and manual dispatch, then deploys `dist/` through the `github-pages` environment. Before enabling delivery, verify that the remote is `chengchuu/pages`, Pages uses GitHub Actions as its source, and environment rules allow the intended branch. Manual dispatch must also comply with those rules. No npm publication is included.

Before deployment, serve the artifact under `/pages/` and check the root directory, all demos, counter behavior, navigation, runtime assets, and browser errors. Local checks do not prove GitHub configuration or live deployment. After an authorized deployment, verify the root and all discovered public routes. Recover a regression through an authorized revert and rebuild; CI dependency resolution can differ from the local lockfile.

## Add a page

Create `src/pages/<name>/index.html` containing a normal HTML document. The next build generates `dist/<name>/index.html`. An optional `index.js` enables a page bundle. Browser scripts use ES modules and can import reusable code from `src/shared/`.

HTML-only pages receive no page bundle. Each page is compiled independently into `dist/<name>/`: production entries use `index.[hash].js`, and development entries use `index.js`. Lazy-loaded chunks and emitted asset modules stay under that page's `chunks/` and `assets/` directories. Shared source dependencies are bundled independently for each page. HTML uses relative bundle URLs, so a page directory can be served on its own. Configured external resources remain external, and source-authored links to sibling pages still require those pages.

Each compiler cleans only its own page directory; coordinated cleanup removes output belonging to deleted pages and the former root asset directory. Never edit generated files.

The development server reloads existing pages after HTML or JavaScript edits. Each page includes a local development-server reload client; neither disk build emits that client or a page bundle for HTML-only pages. Restart the server after adding or removing page directories, adding or removing optional entries, or editing build/page configuration. Page discovery and configuration loading occur when Webpack starts.

## External assets

Project defaults live in `config/external-assets.config.js`. Both environments initially have empty arrays. Optional page configuration uses CommonJS:

```js
module.exports = {
  externalAssets: {
    development: {
      styles: [ { href: "http://127.0.0.1:4132/link.css" } ],
      scripts: [ { src: "http://127.0.0.1:4131/link.js", defer: true } ],
    },
    production: {
      styles: [ { href: "https://i.mazey.net/net/index.css" } ],
      scripts: [ { src: "https://i.mazey.net/net/index.js", defer: true } ],
    },
  },
};
```

These URLs illustrate configuration only; supply resources you actually serve. External resources are linked, not downloaded or bundled. Missing optional configuration, environments, and arrays are treated as empty. Explicitly malformed values fail the build with the configuration path and field.

Webpack mode selects `development` or `production`, defaulting to production when omitted. Page arrays append to shared arrays without replacement or deduplication. Styles require a nonempty `href` and accept `media`, `integrity`, `crossorigin`, and `referrerpolicy`. Scripts require a nonempty `src` and accept boolean `defer`/`async` plus string `type`, `integrity`, `crossorigin`, and `referrerpolicy`. Unknown fields and incorrect value types are rejected. Optional attributes are emitted only when configured; false boolean attributes are omitted. Stylesheets always receive `rel="stylesheet"`.

Configured tags are injected into the head using HtmlWebpackPlugin hooks: shared styles, page styles, shared scripts, page scripts, then the deferred page bundle. Source-authored tags retain their original positions. Classic blocking scripts execute as parsed; deferred classic scripts execute in document order. Async and module scripts follow browser scheduling, so tag order does not guarantee execution order across those categories. Use classic deferred dependencies when page JavaScript requires ordered external initialization.

## Maintenance

The root `webpack.config.js` composes supporting configuration and helpers in `config/`; page discovery lives in `scripts/`. The flat ESLint configuration separates browser modules from CommonJS configuration and Node tests. The nine formatting rules in `eslint.config.js` use warning severity; recommended static-analysis rules report errors. ESLint owns formatting; no separate formatter is installed. ESLint's core formatting rules are deprecated and retained here to match the requested baseline.

```bash
pnpm install --frozen-lockfile
npm run lint
npm run test
npm run build:dev
npm run build
npm run build:pages
npm run validate:pages
git diff --check
git status --short
```

Tests build temporary projects in both modes and cover discovery, HTML-only output, page isolation, external assets, invalid configuration, and stale-output removal. Review generated output and exercise both example routes before changing build behavior.
