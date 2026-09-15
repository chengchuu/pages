# Repository Guide

## Project

This repository is `pages`, a Webpack 5 multi-page frontend project.

The project builds a collection of independent web pages through one shared build system.

See `README.md` for implemented behavior, usage, and deployment guidance. Follow this guide for repository architecture and operating constraints.

## Implemented Commands and Files

Use Node.js 22 or newer. Install and manage dependencies with pnpm; track `pnpm-lock.yaml` and keep `package-lock.json` untracked. Validate installation with `pnpm install --frozen-lockfile`.

Run `npm run lint`, `npm run test`, `npm run build:dev`, and `npm run build` for build changes. `npm run lint:fix` writes files. `npm run dev` serves `/simple/`, `/example/`, and `/link/` at `127.0.0.1:4130`. The `link` page consumes JavaScript from `mazey-polestar` on port `4131` and CSS from `mazey.css` on port `4132`; run `npm run dev` in both sibling projects while developing it. Restart the server after page/entry additions or removals and configuration edits.

`scripts/discover-pages.js` discovers immediate page directories; `config/resolve-external-assets.js` validates and merges configuration; `config/ExternalAssetsPlugin.js` injects escaped asset tags through HtmlWebpackPlugin hooks. `webpack.config.js` composes these helpers. `test/build.test.js` builds isolated temporary fixtures using Node's test runner. See README.md for attribute support and script ordering.

Build configuration and page configuration use CommonJS; browser code uses ES modules. Webpack creates one compiler per page, writing HTML, entry bundles, lazy chunks, and emitted assets under `dist/<page>/`. Production entries use `index.[hash].js`; development entries use `index.js`. Bundle references are relative. Each compiler cleans its own directory; coordinated cleanup removes obsolete outputs. HTML-only pages receive no page bundle in disk builds. Shared external defaults are empty until explicitly configured.

`npm run build:pages` runs production compilation followed by `scripts/generate-pages-index.js`, which creates the static light demo directory at `dist/index.html`. Its CSS and palette are maintained in `config/pages-index.css` and `config/pages-palette.js`. Ordinary builds can remove the root page; do not change cleanup or the development server to preserve it.

Run `npm run validate:pages` after the Pages build. `scripts/validate-pages.js` checks directory membership and supported HTML references under `/pages/`; browser checks must cover runtime-loaded assets separately. Pages tests include generation, failures, presentation, and workflow contracts.

`.github/workflows/pages.yml` builds and deploys on `main` pushes and manual dispatch using Node.js 22, `npm install`, and no dependency caching. The artifact is `dist/`; the target is <https://chengchuu.github.io/pages/>. Remote Pages settings, environment permissions, and live routes require separate verification and deployment authorization. See README.md for validation scope and prerequisites.

---

## Core Architecture

Source code lives under:

```text
src/
├── shared/
└── pages/
```

### Pages

Pages live under:

```text
src/pages/
```

Each page has its own directory.

Example:

```text
src/pages/example/
├── index.html
├── index.js
└── page.config.js
```

Only this file is required:

```text
index.html
```

These files are optional:

```text
index.js
page.config.js
```

A directory containing `index.html` is considered a valid page.

Do not require placeholder `index.js` or `page.config.js` files.

### Shared Code

Reusable browser-side logic belongs under:

```text
src/shared/
```

Use `shared/` for functionality used by multiple pages, including:

- DOM helpers.
- URL helpers.
- Formatting helpers.
- Validation helpers.
- Theme behavior.
- Shared initialization logic.
- Reusable browser utilities.

Do not introduce separate `common/` and `utils/` directories without a clear need.

Prefer domain-specific organization inside `shared/` if it becomes large.

---

## Page Discovery

Pages must be discovered automatically.

Do not maintain a manual central list of page names.

The discovery condition is:

```text
src/pages/<page>/index.html
```

For every discovered page, detect these optional files independently:

```text
index.js
page.config.js
```

Adding or removing a page directory should not require editing Webpack configuration.

Keep page discovery deterministic and easy to understand.

---

## Page JavaScript

`index.js` is optional.

When it exists:

- Create the corresponding Webpack entry.
- Generate the page JavaScript bundle.
- Inject the correct bundle into that page.

When it does not exist:

- Build the page normally.
- Do not create a dummy entry.
- Do not generate an empty page bundle.
- Do not inject references to nonexistent JavaScript.

HTML-only pages are a supported first-class use case.

---

## Page Configuration

`page.config.js` is optional.

Its initial primary purpose is page-specific external asset configuration.

Example:

```js
module.exports = {
  externalAssets: {
    development: {
      styles: [],
      scripts: [],
    },

    production: {
      styles: [],
      scripts: [],
    },
  },
};
```

Do not require pages to repeat project defaults.

Keep the configuration schema small and extensible.

Only introduce new configuration fields when they solve an actual requirement.

Possible future areas include:

- Metadata.
- Title.
- Favicon.
- HTML processing.
- Asset injection behavior.

Do not add speculative configuration merely for completeness.

---

## External Assets

The build system must support external CSS and JavaScript resources.

Assets may differ between:

```text
development
production
```

Example development assets:

```text
http://127.0.0.1:4131/link.js
http://127.0.0.1:4132/link.css
```

Example production assets:

```text
https://i.mazey.net/net/index.js
https://i.mazey.net/net/index.css
```

Use object-based asset definitions.

Example:

```js
styles: [
  {
    href: "https://example.com/index.css",
  },
],

scripts: [
  {
    src: "https://example.com/index.js",
  },
],
```

Do not reduce asset definitions to plain strings if doing so prevents support for normal HTML attributes.

The design should be able to support attributes such as:

```text
defer
async
type
media
integrity
crossorigin
referrerpolicy
```

Only emit attributes that are explicitly configured.

---

## Shared Defaults

Shared external asset defaults should be configured centrally.

A possible location is:

```text
config/external-assets.config.js
```

Page-specific asset arrays should extend shared defaults by default.

Conceptually:

```text
shared assets
+
page assets
=
effective page assets
```

For example:

```js
const styles = [
  ...shared.styles,
  ...page.styles,
];

const scripts = [
  ...shared.scripts,
  ...page.scripts,
];
```

Avoid requiring the same asset declaration in many page configuration files.

If override or removal behavior becomes necessary later, design it explicitly rather than introducing ambiguous merging rules.

---

## Environment Handling

Use Webpack's `mode` as the primary environment source.

Supported initial modes:

```text
development
production
```

Typical commands:

```bash
webpack --mode development
webpack --mode production
```

Do not introduce a parallel environment system unless the project later requires additional environments such as staging or preview.

Environment-dependent external assets should derive from the resolved Webpack mode.

---

## HTML

Every page source must provide:

```text
index.html
```

Source HTML should remain normal HTML.

Do not require page authors to add Webpack-specific loops, placeholders, or repetitive template code solely for external asset injection.

The build system should handle:

- Page bundle injection.
- Shared stylesheet injection.
- Page stylesheet injection.
- Shared script injection.
- Page script injection.
- Environment-specific asset selection.

External CSS should normally be injected into:

```html
<head>
```

External JavaScript ordering must be deterministic.

Document any ordering rules introduced by the implementation.

Avoid unnecessary HTML transformations.

---

## Output

Generated production output belongs under:

```text
dist/
```

A source page such as:

```text
src/pages/example/index.html
```

should normally generate:

```text
dist/example/index.html
```

`dist/` is generated output.

Rules:

- Never manually edit files under `dist/`.
- Never use generated files as the source of truth.
- Regenerate output through project scripts.
- Keep source files outside `dist/`.
- It must be safe to delete and recreate `dist/`.

When a task requires changing generated output, modify the source or build logic that produces it.

---

## Build-System Code

Keep browser runtime code and build-system code separate.

Browser code belongs under:

```text
src/
```

Build helpers should live outside `src/`.

Potential locations include:

```text
config/
scripts/
```

Examples:

```text
config/
├── external-assets.config.js
├── resolve-external-assets.js
└── ExternalAssetsPlugin.js

scripts/
└── discover-pages.js
```

These names are architectural directions, not mandatory files.

Do not create directories or helper modules until they provide a clear responsibility.

Prefer several focused helpers over one oversized `webpack.config.js`, but do not fragment simple logic unnecessarily.

---

## Configuration Principles

Configuration should follow a predictable hierarchy.

Conceptually:

```text
Webpack defaults
      ↓
Project defaults
      ↓
Page configuration
      ↓
Environment-specific values
```

Prefer:

- Explicit behavior.
- Small configuration surfaces.
- Predictable merging.
- Safe defaults.
- Low duplication.

Avoid:

- Hidden global behavior.
- Deeply nested configuration without need.
- Multiple competing sources of truth.
- Environment logic scattered across unrelated modules.

---

## Development Principles

Prefer:

- Simple conventions.
- Automatic discovery where behavior is predictable.
- Explicit configuration where behavior differs.
- Minimal required files.
- Low duplication.
- Small focused modules.
- Community-standard frontend practices.
- Incremental complexity.
- Clear naming.
- Deterministic builds.

Avoid:

- Premature abstractions.
- Placeholder files.
- Manually maintained page registries.
- Duplicated configuration.
- Build-specific markup repeated across pages.
- Large monolithic configuration files.
- Clever behavior that is difficult to trace.
- Unnecessary dependencies.

When multiple implementations are possible, prefer the simplest one that satisfies the requested behavior and this guide's architecture constraints.

---

## Dependency Changes

Before adding a dependency:

1. Confirm that the requirement cannot be handled cleanly with existing project dependencies or Node.js/Webpack APIs.
2. Prefer established packages with active maintenance.
3. Avoid overlapping packages that solve the same problem.
4. Keep runtime dependencies minimal.
5. Use development dependencies for build-only tooling.

Do not install packages merely to simplify a few lines of straightforward build logic.

When removing or replacing a dependency, verify all imports, scripts, configuration, and build behavior that depend on it.

---

## Webpack

Use Webpack 5.

Do not migrate the project to Vite, Rollup, Parcel, or another build system unless explicitly requested.

Webpack configuration should support:

- Automatic page discovery.
- Optional page entries.
- One HTML output per discovered page.
- Environment-aware builds.
- External asset injection.
- Shared defaults.
- Predictable production output.

Use standard Webpack and plugin APIs rather than fragile string replacement of generated HTML where practical.

If custom Webpack plugins or hooks are introduced, keep them focused and document why built-in behavior was insufficient.

---

## Error Handling

Build configuration should fail clearly for invalid project state.

Examples of useful failures include:

- Invalid page configuration.
- Invalid external asset definitions.
- Duplicate page output names.
- Unsupported configuration values.
- Missing required files when explicitly referenced.

Do not silently ignore malformed configuration when doing so could produce incorrect output.

Optional files that simply do not exist are normal and must not be treated as errors.

Error messages should identify the affected page or configuration file whenever possible.

---

## Validation

When modifying build behavior, verify representative page types.

At minimum, cover:

```text
HTML only
HTML + JavaScript
HTML + page configuration
HTML + JavaScript + page configuration
```

Also verify:

```text
shared defaults only
page assets only
shared + page assets
development assets
production assets
```

Confirm that HTML-only pages do not receive unnecessary bundles.

Confirm that external assets are injected into the correct page and environment.

Confirm that the production build can recreate `dist/` from source.

---

## Testing Changes

After meaningful implementation changes, run the relevant project checks available in `package.json`.

At minimum, verify the build in both modes when the change affects environment-specific behavior:

```bash
webpack --mode development
webpack --mode production
```

Prefer project scripts once they exist, for example:

```bash
npm run build
npm run dev
```

Do not claim a check passed unless it was actually run successfully.

When a check cannot be run, state that clearly.

---

## Generated Files

Before editing a file, determine whether it is generated.

Common generated locations may include:

```text
dist/
coverage/
```

Do not manually patch generated artifacts to make tests or builds pass.

Fix the owning source, configuration, or generator instead.

---

## Existing User Changes

Preserve unrelated user modifications.

Before making broad changes:

```bash
git status --short
```

Review the current working tree where appropriate.

Do not overwrite unrelated work.

Avoid destructive Git operations such as:

```bash
git reset --hard
git clean -fd
```

unless explicitly requested.

Do not commit, push, create tags, publish packages, or deploy unless explicitly requested.

---

## Documentation

Keep these responsibilities distinct:

```text
AGENTS.md
```

Defines how coding agents should work within the repository.

```text
README.md
```

Explains installation, usage, development commands, and deployment.

When implementation decisions materially change architecture or behavior, update the appropriate documentation.

Link to maintained documentation rather than duplicating large sections into unrelated files.

---

## Initial Success Standard

A healthy implementation should allow creation of:

```text
src/pages/example/index.html
```

without any central page registration.

Adding:

```text
src/pages/example/index.js
```

should automatically enable a page-specific JavaScript bundle.

Adding:

```text
src/pages/example/page.config.js
```

should automatically enable page-specific configuration.

The page should be able to:

- Use project-level external asset defaults.
- Add page-specific external assets.
- Resolve development and production assets automatically.
- Reuse code from `src/shared/`.
- Build into `dist/`.
- Remain independent from unrelated pages.

The architecture should stay easy to understand as additional pages are added.

When in doubt, choose the solution that keeps this workflow simple.
