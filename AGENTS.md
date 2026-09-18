# Repository guide

## Project and source ownership

`pages` is a Webpack 5 multi-page frontend project. Read `README.md` for user-facing commands and behavior. The current pages are `example` (JavaScript counter), `simple` (HTML only), and `link` (HTML with external CSS and JavaScript). The live demo target is <https://chengchuu.github.io/pages/>.

`src/pages/<name>/index.html` is the only required file for a page. `scripts/discover-pages.js` finds immediate page directories, sorts them by name, and detects optional `index.js` and `page.config.js` files independently. Do not add a central page registry or placeholder files. Browser modules and reusable browser logic belong in `src/pages/` and `src/shared/`; build configuration and scripts belong outside `src/`.

Build and page configuration use CommonJS. Browser `index.js` files use ES modules. `page.config.js` currently supports only `externalAssets`; do not add speculative configuration fields. `config/external-assets.config.js` owns shared external asset defaults, which are empty in both modes. `config/resolve-external-assets.js` validates asset objects and appends page arrays after shared arrays without replacement or deduplication. Webpack `mode` selects `development` or `production` assets.

External styles require a nonempty `href` and may specify `media`, `integrity`, `crossorigin`, and `referrerpolicy`. External scripts require a nonempty `src` and may specify boolean `defer` or `async` and string `type`, `integrity`, `crossorigin`, and `referrerpolicy`. Unknown fields and incorrect types fail the build with a configuration path. `config/ExternalAssetsPlugin.js` injects escaped tags through HtmlWebpackPlugin hooks: the configured favicon from `config/site.config.js`, shared styles, page styles, shared scripts, page scripts, then Webpack's deferred page bundle. Source-authored tags retain their positions. Do not require build-specific markup in page HTML.

## Build and generated output

Use Node.js 22 or newer. Use pnpm for local dependency operations and npm for project scripts. Track `pnpm-lock.yaml`, leave `package-lock.json` untracked, and verify the recorded dependency graph with `pnpm install --frozen-lockfile`. GitHub Actions uses `npm install` without npm dependency caching or `npm ci`; npm does not consume the pnpm lockfile.

The maintained commands are:

| Command                  | Result                                                   |
|:-------------------------|:---------------------------------------------------------|
| `npm run dev`            | Serve discovered pages at `127.0.0.1:4130`               |
| `npm run build:dev`      | Write a development build to `dist/`                     |
| `npm run build`          | Write a production build to `dist/`                      |
| `npm run build:pages`    | Build production pages, then generate `dist/index.html`  |
| `npm run validate:pages` | Validate the existing Pages artifact without rebuilding |
| `npm run lint`           | Check JavaScript with ESLint                             |
| `npm run lint:fix`       | Apply ESLint fixes; this writes files                    |
| `npm run test`           | Run Node tests                                           |

`webpack.config.js` creates one compiler per discovered page. It writes HTML and any page bundle, lazy chunks, or emitted assets under `dist/<name>/`. Production page entries use `index.[contenthash:8].js`; development entries use `index.js`. Disk builds use relative bundle URLs. HTML-only pages receive no page bundle. Each compiler cleans its own output directory, and coordinated cleanup removes obsolete root entries. `dist/` is ignored, disposable output; never edit or commit it by hand.

The development server has no root landing page or SPA fallback. It adds a reload client to served pages, including HTML-only pages. Restart it after adding or removing page directories or optional entry files, or after changing build or page configuration. Discovery and configuration loading occur at startup.

`npm run build:pages` runs the production build before `scripts/generate-pages-index.js`. The generator reuses page discovery to create a root directory of demos. Its light-only CSS is maintained in `config/pages-index.css`; `config/pages-palette.js` retains the supplied light and dark token pairs, but the generated page emits only light values. The directory has no JavaScript. Ordinary Webpack builds can remove `dist/index.html`, so regenerate the complete Pages artifact with `build:pages` before validation or deployment.

`scripts/validate-pages.js` checks the root directory's membership, supported local anchor, script, stylesheet, and image references, artifact boundaries, and unwanted development or HTML-only bundles under `/pages/`. It rejects `<base>` elements. It does not fetch external URLs or inspect CSS URLs, `srcset`, or runtime-created references. Verify those separately in a browser when relevant.

## Link page and external services

`src/pages/link/` is HTML-only. Its `page.config.js` loads development CSS from `http://127.0.0.1:4132/link.css` and JavaScript from `http://127.0.0.1:4131/link.js`; production assets are external URLs configured in that file. For local Link development, run `npm run dev` in `pages`, `mazey-polestar`, and `mazey.css`. Open <http://127.0.0.1:4130/link/> and refresh after CSS changes. Keep the external asset references explicit; Webpack does not bundle those sibling projects.

## Tests and deployment

`test/build.test.js` uses temporary fixtures to check both Webpack modes, page discovery, optional entries, external assets, output isolation, and cleanup. `test/pages.test.js` checks directory generation, Pages validation, presentation, and workflow contracts. Use `npm run lint`, `npm run test`, `npm run build:dev`, and `npm run build` for build changes. For Pages changes, also run `npm run build:pages` and then `npm run validate:pages`. Inspect the final artifact under the `/pages/` mount path when links or runtime assets change. Do not claim a check passed unless it ran successfully.

`.github/workflows/pages.yml` builds and deploys on pushes to `main` and manual dispatch. Its build job uses Node.js 22, installs with `npm install`, then runs lint, tests, development build, Pages build, and Pages validation before uploading `dist/`. Its deploy job uses the `github-pages` environment. The workflow does not publish an npm package. Verify remote Pages settings, environment branch rules, and live routes separately before treating deployment as complete. Do not dispatch or deploy as routine local validation.

## Editing rules

Inspect `git status --short` before editing and preserve unrelated changes. Change source files, configuration, or generators instead of generated output. Keep edits narrow, validate the affected behavior, then run `git diff --check` and inspect status. Do not stage, commit, push, create tags, publish, or deploy unless requested.

`AGENTS.md` describes repository working rules; `README.md` describes implemented behavior and usage. Files under `guides/` are plans, not proof that a feature is implemented. If behavior changes, update the relevant documentation using the current code as the source of truth.
