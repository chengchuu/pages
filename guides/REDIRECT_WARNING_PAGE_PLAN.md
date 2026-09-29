# Redirect Warning Page Plan

## Summary

Add a public warning page that receives an independent destination through one
`url` query parameter, displays the destination, and requires the user to choose
an explicit Continue link. The page does not redirect automatically.

Keep the existing sibling-project boundaries:

- `pages` owns the HTML page and external asset declarations.
- `mazey-polestar` owns the browser module that reads, validates, and presents
  the destination.
- `mazey.css` continues to provide the existing compiled `base.css`; this
  feature does not change its Sass or generated CSS.

The page is an independent static frontend service. Backend integration is
reserved for a separate plan.

## Confirmed Product Contract

- The destination is supplied as `?url=<percent-encoded destination>`.
- Require exactly one nonempty `url` query parameter. Missing, empty, or
  duplicate parameters are invalid.
- Use Mazey's `isValidUrl()` result exactly as the final destination validator.
  Do not add a protocol allowlist, protocol denylist, native `URL` validation,
  normalization, or a special case for `file:` URLs.
- Do not redirect automatically, add a countdown, or trigger navigation from
  page initialization.
- For a valid destination, use `.base base-info`, show the destination, and
  expose an explicit Continue link.
- For invalid input, use `.base base-error`, explain the error, and do not
  expose a navigable Continue link.
- Describe a valid result as recognized by the validator, not verified, safe,
  or trusted.

The selected validator intentionally inherits its current behavior. Examples
include:

| Destination shape | Expected result |
|:------------------|:----------------|
| `https://example.com` | Valid |
| `ftp://example.com/file.txt` | Valid |
| `file://localhost/path` | Valid |
| `file:///path` | Invalid |
| `mailto:user@example.com` | Invalid |
| `tel:+123456789` | Invalid |
| `ssh://example.com/path` | Valid |
| `custom://example.com/path` | Valid |
| A matching `javascript://...`, `data://...`, or `about://...` shape | May be valid |

These results are part of this feature's deliberate contract unless Mazey's
public validator changes separately.

## Architecture

```text
direct URL
    |
    v
pages /redirect/?url=<encoded destination>
              |
              +-- base.css from mazey.css
              |
              +-- redirect.js from mazey-polestar
                         |
                         +-- read exactly one url value
                         +-- call Mazey isValidUrl()
                         +-- render base-info or base-error
                         +-- wait for an explicit Continue click
```

The static page is the complete service boundary. No backend, API, datastore,
session, token exchange, or page-local bundle is required.

## Implementation Plan

### 1. Add the HTML page in `pages`

- Add `src/pages/redirect/index.html` as an HTML-only page.
- Start with a safe, non-navigable `.base base-error` state so a missing or
  failed JavaScript asset cannot expose an unchecked destination.
- Include a short warning that the destination has not been verified and may
  open an external website, file, or application.
- Provide dedicated elements for the status text, destination text, and
  Continue link. The initial Continue element must not have a destination
  `href`.
- Keep navigation in the current tab unless a later product requirement
  explicitly selects a new browsing context.
- Add a no-referrer policy so the warning-page URL, including its nested
  destination query, is not sent to an HTTP destination through the Referer
  header.
- Do not add a local `index.js`; the behavior remains owned by
  `mazey-polestar`.

### 2. Declare sibling assets in `pages`

- Add `src/pages/redirect/page.config.js` using only the supported
  `externalAssets` field.
- In development, load:
  - `http://127.0.0.1:4132/base.css`
  - `http://127.0.0.1:4131/redirect.js`
- In production, load:
  - `https://i.mazey.net/style/lib/base.css`
  - `https://i.mazey.net/polestar/lib/redirect.js`
- Load the JavaScript with `defer` and preserve the existing external asset
  ordering and escaping behavior.
- Rely on normal page discovery so `/redirect/` participates in development,
  production, and the generated root Pages directory. Do not add a central
  page registry or placeholder entry.

### 3. Add the browser module in `mazey-polestar`

- Add a root library entry at `src/redirect.js`; do not place this behavior in
  the Polestar demo-page directory.
- Import and reuse Mazey's `getUrlParam()` and `isValidUrl()` utilities.
- Read `url` with the array-returning query API so duplicate parameters can be
  rejected rather than silently selecting one.
- Treat the input as valid only when there is exactly one nonempty value and
  `isValidUrl(value)` returns `true`.
- Do not trim, normalize, reparse, or apply any additional scheme policy after
  `isValidUrl()`.
- Insert all destination and status content with text APIs, never HTML parsing.
- On a valid result:
  - replace `base-error` with `base-info`;
  - display the original decoded query value;
  - assign that exact value to the Continue anchor's `href`;
  - expose the Continue anchor without programmatically activating it.
- On an invalid result, preserve `base-error`, show the applicable message, and
  leave the Continue anchor non-navigable.
- Add `redirect` to the aggregate development entry map so `npm run dev` serves
  `/redirect.js` from port `4131` without a Webpack client or reload runtime.
- Add a focused production command that emits `lib/redirect.js` through the
  existing library build configuration. Do not change the intentionally
  no-op aggregate `npm run build` contract unless separately requested.

### 4. Update implemented-behavior documentation

- Update the `pages` README and `AGENTS.md` page inventory and local workflow
  after the page exists.
- Update the `mazey-polestar` README and `AGENTS.md` entry inventory, build
  command, and development endpoint after the module exists.
- Document the validator's actual syntax boundary without describing accepted
  destinations as safe.
- Do not update `mazey.css` documentation because its public `base.css` contract
  does not change.

## Testing Plan

### `pages`

- Assert that development and production builds generate `/redirect/` as an
  HTML-only page with no local page bundle.
- Assert the exact development and production Base CSS and Redirect JavaScript
  URLs and `defer` behavior.
- Assert that the source HTML begins with `.base base-error`, contains the
  warning and destination output, and has no initially navigable Continue link.
- Assert the page appears in the generated root Pages directory and passes
  Pages artifact validation.
- Run `npm run lint`, `npm run test`, `npm run build:dev`, `npm run build`,
  `npm run build:pages`, and `npm run validate:pages`.

### `mazey-polestar`

- Add focused tests for missing, empty, duplicate, valid, and invalid `url`
  values.
- Lock the exact `isValidUrl()` contract with representative HTTP, FTP,
  host-qualified file, ordinary triple-slash file, custom, and scheme-shaped
  executable destinations.
- Assert that valid input produces `base-info` and a Continue `href` only after
  initialization, while invalid input preserves `base-error` and no navigable
  link.
- Assert that displayed attacker-controlled text is not interpreted as HTML.
- Assert the exact development entry path, output filename, port, and absence
  of the Webpack reload client from `redirect.js`.
- Build the production artifact and confirm `lib/redirect.js` contains no
  unintended production obfuscation or development client.
- Run the repository's lint, tests, the new focused build command, and
  formatting checks that exist at implementation time.

### Integration

- Run the three frontend development servers on ports `4130`, `4131`, and
  `4132` and open representative `/redirect/?url=...` cases.
- Confirm that no case redirects before the user activates Continue.
- Confirm valid and invalid classes and the absence of browser console errors.
- Confirm representative accepted schemes follow browser or operating-system
  behavior without the page claiming guaranteed support.
- Confirm manually constructed URLs preserve destinations containing their own
  query and fragment when those destinations are correctly percent-encoded.
- Finish the `pages` and `mazey-polestar` repositories with `git diff --check`
  and inspect their final status and diff.

## Security and Compatibility Risks

- `isValidUrl()` checks a URL shape, not trust or navigation safety. Accepted
  schemes can include executable, browser-internal, or external-application
  destinations.
- An explicit Continue action reduces surprise but does not neutralize a
  dangerous accepted scheme.
- The full destination is exposed in the warning URL, browser history, copied
  links, screenshots, and potentially access logs.
- `file:` destinations can reveal local path names and remain browser- and
  platform-dependent.
- FTP support varies and may be absent or delegated to an external application.
- A public warning page remains usable as a phishing interstitial.
- The static page depends on separately deployed CSS and JavaScript artifacts;
  a missing JavaScript asset leaves the deliberately non-navigable error state.
- Future Mazey releases can change `isValidUrl()` behavior. Tests must make any
  resulting public behavior change explicit during dependency upgrades.

## Non-Goals

- Do not create a destination database, server-side token, session, preview,
  reputation check, malware scan, or URL-expansion service.
- Do not add automatic navigation, a countdown, or a bypass parameter.
- Do not add protocol filtering beyond the exact `isValidUrl()` result.
- Do not change `base.scss`, `base.css`, or other `mazey.css` entries.
- Do not add backend integration; that work belongs to the next plan.
- Do not claim that accepted destinations are verified or safe.

## Delivery Order and Rollback

1. Add and validate the Polestar redirect module and production artifact.
2. Add and validate the Pages warning page against the sibling development
   servers and production asset URLs.
3. Deploy the static assets and verify the independent query-string workflow.
4. Roll back the static feature by removing its page and library entry in their
   owning repositories.

Any future backend integration must begin only after the independent deployed
page and its required frontend assets are verified as available.

## Assumptions

- The page name and route are `redirect` and `/redirect/`.
- Production assets continue to use the existing `i.mazey.net` CSS and
  Polestar library origins.
- The exact installed Mazey validator behavior is intentional, including its
  rejection of ordinary `file:///...` URLs and acceptance of arbitrary matching
  `scheme://...` values.
- The Continue control is a semantic anchor because its only action is
  navigation.
- Backend integration will be designed separately and may rely on the
  independent page only after its public contract is deployed and verified.
