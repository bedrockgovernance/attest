# Changelog

All notable changes to `@bedrockgovernance/attest` will be documented in
this file. The format is based on [Keep a Changelog][keep] and the
package adheres to [Semantic Versioning][semver].

[keep]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html

## [Unreleased]

## [0.1.0]

### Added

- Initial release.
- `Bedrock` client with `attest(generation)`, posting a generation
  bundle to `POST /v1/generations` and returning `{ generationId,
  correlationId, outputHash, recordedAt }`.
- `validateGeneration(generation)` local validation of required fields.
- `attestMiddleware(options)` AI SDK `LanguageModelV2Middleware`
  (exported from `@bedrockgovernance/attest/ai-sdk`) that notarises
  every model call in the background without adding latency.
- `BedrockError`, `BedrockValidationError` and `BedrockApiError` error
  types, plus the full generation type surface.
