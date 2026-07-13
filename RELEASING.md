# Releasing @bedrockgovernance/attest

## Pre-flight

- [ ] CI green on `main`.
- [ ] `npm test` passes at 100% coverage.
- [ ] `npm run lint` and `npm run typecheck` clean.
- [ ] `CHANGELOG.md` updated.

## One-time setup

1. The npm scope `@bedrockgovernance` already exists (shared with
   `@bedrockgovernance/notary`).
2. Publishing uses OIDC trusted publishing; no `NPM_TOKEN` secret is
   required.

## Cutting a release

1. Bump `version` in `package.json`.
2. Move `## [Unreleased]` notes in `CHANGELOG.md` to a dated heading.
3. Commit and merge to `main`.
4. The **Publish** workflow detects the version change, publishes, and
   tags the release.
5. Verify on <https://www.npmjs.com/package/@bedrockgovernance/attest>.

## Yanking

```sh
npm deprecate @bedrockgovernance/attest@<version> "see SECURITY-ADVISORY-..."
```
