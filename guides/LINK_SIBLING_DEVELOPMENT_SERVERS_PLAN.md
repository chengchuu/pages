# Link sibling development servers plan

Status: Plan only. This document does not authorize implementation, dependency changes, generated-output edits, publishing, or deployment.

## Goal

Create a `link` page whose HTML, JavaScript, and CSS remain owned by their existing projects while all three projects run independently during local development.

The selected local contract is:

| Project           | Responsibility | Command            | Development URL                         |
|:------------------|:---------------|:-------------------|:----------------------------------------|
| `pages`            | HTML           | `npm run dev`      | `http://127.0.0.1:4130/link/`           |
| `mazey-polestar`   | JavaScript     | `npm run dev:link` | `http://127.0.0.1:4131/link.js`         |
| `mazey.css`        | CSS            | `npm run dev:link` | `http://127.0.0.1:4132/link.css`        |

All three processes are expected to run while developing the integrated page.

## Confirmed decisions

- Use additive entry-specific development servers.
- Rename the existing `mazey-polestar` command from `serve:link` to `dev:link`; do not retain the old alias unless an external consumer is discovered before implementation.
- Add `dev:link` to `mazey.css` without replacing its documentation-site `dev` command.
- Keep `pages` as the only owner of the new `link` HTML page.
- Keep `mazey-polestar` as the owner of the `link.js` source and bundle.
- Keep `mazey.css` as the owner of the `link.css` source and package artifact.
- Use `127.0.0.1` consistently for local server bindings and external asset URLs.
- Do not add a repository-level process orchestrator. Developers start the three processes separately.
- Accept manual browser refresh for CSS changes in the initial implementation.

## Current behavior and cause

`pages` discovers immediate directories containing `src/pages/<name>/index.html`. Its optional `index.js` and `page.config.js` files are detected independently. This already supports an HTML-only page that loads external JavaScript and CSS, but the current development server uses port `8080`, and no `link` page exists.

`mazey-polestar` currently builds and serves the `link` entry as a combined development page on port `9202`. The JavaScript bundle already mounts itself into `#tiny-box` and exposes `window.TINY_INIT`. Its legacy HTML template also creates the mount element, so HTML ownership is duplicated today.

`mazey.css` already builds `src/z-style/link.scss` into `lib/link.css`. It provides `build:link` and `watch:link`, but it has no entry-specific HTTP server. Its existing `dev` command serves the separate package website and playground.

The missing integration is therefore development-server and page configuration, not a new application runtime.

## Scope

### `pages`

- Change the development-server port from `8080` to `4130`.
- Add `src/pages/link/index.html` as the canonical HTML shell.
- Add `src/pages/link/page.config.js` for environment-specific external assets.
- Keep the page HTML-only by omitting `src/pages/link/index.js`.
- Update repository documentation and focused tests for the new route, port, and external assets.

### `mazey-polestar`

- Rename the `serve:link` package script to `dev:link`.
- Change the `link` development-server port from `9202` to `4131`.
- Preserve the existing `build:link` production command and JavaScript entry.
- Update maintained references to the old command or port, including the nested `src/pages/link/AGENTS.md` guide.
- Review the hard-coded `localhost:9202` compatibility condition and the old development URL in `testExamples.txt`; update or generalize them only where current behavior requires it.
- Configure development reload behavior so the client connects to the server on port `4131` even though the document origin is port `4130`.

### `mazey.css`

- Add a `dev:link` package script that serves the `link` package entry on port `4132`.
- Add a focused development configuration around the existing package build instead of repurposing `webpack.site.config.js`.
- Preserve the current documentation-site `dev` command, `build:link`, `watch:link`, package exports, and published artifact paths.
- Update maintained documentation for the new command.

## Non-goals

- Do not merge the projects or introduce a monorepo workspace.
- Do not copy JavaScript or Sass source into `pages`.
- Do not add placeholder `index.js` files to the HTML project.
- Do not make `pages` proxy the sibling development servers.
- Do not add cross-repository filesystem watching or a shared process runner.
- Do not add a JavaScript reload client from the CSS server solely to obtain CSS hot reload.
- Do not redesign the `link` interface, React state, API calls, theme system, or stylesheet selectors.
- Do not change package exports, npm publication, GitHub Pages workflows, or production hosting without a separately confirmed requirement.
- Do not edit `dist/`, `lib/`, `docs/`, or other generated output manually.

## Target page contract

The new `pages/src/pages/link/index.html` should provide:

- a complete HTML document with language, character encoding, viewport metadata, and a descriptive title;
- one `#tiny-box` mount element before the deferred JavaScript executes;
- the existing `window.TINY_FOREIGN_BASE_URL` runtime setting before `link.js` initializes;
- no page-owned application bundle.

The page configuration should load these development assets in deterministic order:

1. `http://127.0.0.1:4132/link.css`
2. `http://127.0.0.1:4131/link.js` as a deferred classic script

The existing external-asset plugin should remain responsible for tag creation, escaping, and injection. The page must not duplicate those tags in its HTML template.

Production configuration is a separate asset contract. The established integration templates currently point to these candidates:

- `https://i.mazey.net/style/lib/link.css`
- `https://i.mazey.net/polestar/lib/link.js`

Verify both URLs and their current contents before adding them to `page.config.js`. If either URL is unavailable or no longer authoritative, stop and obtain the correct production URL instead of inventing or copying an asset.

## Development-server behavior

### HTML server

The `pages` server should continue serving every discovered page through one Webpack multi-compiler server. Changing its port must not create a dedicated server that bypasses automatic discovery.

Its reload client should continue handling changes inside `pages`. Adding or removing the `link` directory or its optional configuration still requires a server restart because discovery and page configuration are resolved at startup.

### JavaScript server

The `mazey-polestar` server should serve the existing `link.js` bundle from the root URL on port `4131`. Disable hot module replacement for this entry and prefer a full document reload because the bundle automatically creates a React root.

If the Webpack development client remains enabled, configure its WebSocket connection explicitly for the JavaScript server. It must not infer port `4130` from the containing page and connect to the HTML server by mistake.

The legacy generated development HTML may remain available as build scaffolding, but documentation should identify the `pages` route as the integrated development page. Removing the legacy HTML generation is outside this plan.

### CSS server

The `mazey.css` server should compile the existing `link` entry in development mode and serve `link.css` from the root URL on port `4132`. The server should not build or serve the documentation website as part of this command.

The current extraction entry can also produce an empty or loader-oriented `link.js`; the `pages` project must not load it. Suppressing that internal output would require a broader package-build change and is outside this plan.

Because the browser loads only the stylesheet from port `4132`, CSS changes may not trigger a page reload. The developer can refresh `http://127.0.0.1:4130/link/` after a successful CSS rebuild.

## Proposed implementation phases

### 1. Establish the producer servers

1. Rename and configure the `mazey-polestar` development command and port.
2. Add the focused `mazey.css` development command and configuration.
3. Confirm that each server exposes its expected root asset without requiring its own HTML page.
4. Update command and port references in maintained documentation.

### 2. Add the HTML consumer

1. Change the `pages` development-server port to `4130`.
2. Add the HTML-only `link` page and its page configuration.
3. Confirm that automatic discovery includes `link` without a central page registry.
4. Confirm that development output contains no page-owned `index.js` bundle for `link`.

### 3. Validate the integrated workflow

1. Start all three processes with their selected commands.
2. Open `http://127.0.0.1:4130/link/`.
3. Confirm that the browser receives `link.js` from port `4131` and `link.css` from port `4132`.
4. Confirm that the React interface mounts once in `#tiny-box` and receives the expected styles.
5. Exercise input, short-link generation, copy behavior, message links, backup-link behavior when configured, and repeated QR-code generation.
6. Check browser console, network, WebSocket, and mixed-content errors.
7. Change each maintained source type during a manual development smoke test and verify the documented reload or refresh behavior.

## Validation after implementation approval

Run repository-local checks without installing new dependencies unless the existing installations are incomplete.

### `pages`

1. Run `npm run lint`.
2. Run `npm run test`.
3. Run `npm run build:dev`.
4. Run `npm run build`.
5. Run `npm run build:pages`.
6. Run `npm run validate:pages`.
7. Run `git diff --check`.
8. Inspect `git status --short` and the final diff.

Extend focused tests to verify port `4130`, page discovery, development and production asset selection, tag ordering, and the absence of a page-owned bundle for `link`.

### `mazey-polestar`

1. Run `npm test`.
2. Run the repository's lint check without accepting unrelated formatting changes.
3. Run `npm run build:link`.
4. Start `npm run dev:link` and verify `http://127.0.0.1:4131/link.js`.
5. Run `git diff --check`.
6. Inspect `git status --short` and the final diff.

Add focused regression coverage for the renamed command, port contract, and any changed localhost compatibility behavior where practical.

### `mazey.css`

1. Run `npm run typecheck`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build:link`.
5. Run `npm run package:validate`.
6. Start `npm run dev:link` and verify `http://127.0.0.1:4132/link.css`.
7. Run `npm run format:check`.
8. Run `git diff --check`.
9. Inspect `git status --short` and the final diff.

Review any generated `lib` changes after the builds. Because this plan does not change JavaScript or Sass behavior, unexpected generated artifact changes should be treated as drift and must not be included without explanation and approval.

## Risks and mitigations

- **Partial startup:** The HTML can load without one or both producer assets. Document the three required commands and use browser network errors to identify the missing process.
- **Port collisions:** Another local process can occupy ports `4130` through `4132`. Fail visibly rather than selecting a different port automatically, because the page configuration depends on fixed URLs.
- **Host mismatch:** Mixing `localhost` and `127.0.0.1` can complicate origin and WebSocket behavior. Bind and reference all three servers through `127.0.0.1`.
- **Incorrect WebSocket origin:** A JavaScript development client running inside the port-`4130` page can connect to the wrong server. Pin its WebSocket endpoint to port `4131` and verify it in browser tools.
- **Duplicate React initialization:** Hot updates can re-execute the self-initializing bundle. Disable hot module replacement and validate that only one React root mounts after rebuilds.
- **CSS refresh expectations:** The CSS server has no client script in the page. Document manual refresh instead of introducing hidden coupling.
- **Global CSS variables:** `link.css` defines theme properties on `:root`. Keep the HTML shell minimal and verify that any page-level styling does not conflict with those properties.
- **Production asset drift:** Existing hosted paths may move independently of the three repositories. Verify production URLs and test the built page before deployment.
- **Generated-output drift:** Package builds write committed `lib` artifacts. Review generated diffs and preserve source ownership instead of patching outputs manually.
- **Existing user changes:** Preserve the current `.vscode/settings.json` change in `mazey-polestar` and the current `.vscode/settings.json` and `package.json` changes in `mazey.css`.

## Rollback

Rollback requires no data migration:

1. Remove the newly added `pages/src/pages/link/` source directory.
2. Restore the previous `pages` development-server port.
3. Restore the `mazey-polestar` script name and port, plus any references changed with them.
4. Remove the new `mazey.css` `dev:link` script and focused development configuration.
5. Regenerate only the artifacts owned by an affected source change, then rerun the focused checks.

Do not use destructive Git cleanup. Preserve unrelated working-tree changes throughout rollback.

## Acceptance criteria

- [ ] `npm run dev` serves the discovered `pages` routes on `127.0.0.1:4130`.
- [ ] `npm run dev:link` serves `mazey-polestar` JavaScript at `127.0.0.1:4131/link.js`.
- [ ] `npm run dev:link` serves `mazey.css` styles at `127.0.0.1:4132/link.css` without replacing its website development command.
- [ ] `http://127.0.0.1:4130/link/` loads the JavaScript and CSS from their owning sibling projects.
- [ ] The `link` page is discovered from `index.html` and produces no page-owned application bundle.
- [ ] The JavaScript mounts exactly once into `#tiny-box` and preserves current link-generation behavior.
- [ ] JavaScript reload and CSS refresh behavior match the documented contract.
- [ ] Production assets are either verified and configured or explicitly left blocked pending authoritative URLs.
- [ ] Focused tests, builds, artifact validation, browser checks, and `git diff --check` pass in all affected repositories.
- [ ] Existing unrelated working-tree changes remain intact.
- [ ] Documentation uses `dev:link` consistently and no maintained reference still instructs developers to use `serve:link`.

None of these implementation criteria is complete merely because this plan exists.
