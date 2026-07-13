# Security policy

## Reporting a vulnerability

If you discover a security issue in `@bedrockgovernance/attest`, for
example an authentication bypass, a way to make the client send data to
an unintended host, or leakage of an API key or prompt content, please
report it privately to `security@bedrockgovernance.com`. Do not open a
public issue.

We will acknowledge receipt within two business days and provide a
target fix date within five.

## Threat model

`@bedrockgovernance/attest` is a thin client. It validates a generation
bundle and posts it to the Bedrock API over HTTPS using a firm API key.

- The `apiKey` is a secret. Keep it server-side. Prompts and context
  routinely contain client financial data, so the generation bundle is
  sensitive: only ever send it to a Bedrock API host you control the
  configuration of via `baseUrl`.
- The AI SDK middleware posts attestations in the background and must
  never throw into the wrapped model call; a regression that does is a
  reliability issue we treat seriously.

## Out of scope

- Bugs in the wider Bedrock platform or API.
- Vulnerabilities in the AI SDK or any provider package.
- Misuse of a leaked API key that originated outside this library.
