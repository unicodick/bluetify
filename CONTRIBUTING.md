# Contributing

Thanks for helping improve Bluetify.

## Development

Use Node.js 22 or newer and install the locked dependency graph:

```sh
npm ci
npm run build
npm test
npm audit
```

Keep changes focused and add tests for observable behavior. Update the README
when configuration, lifecycle behavior, or deployment requirements change.

## Commits

Use a short conventional commit in English with no body or footer:

```text
type(scope): text
```

Examples:

```text
fix(state): preserve pending bio updates
feat(config): support custom pds origins
```

## Pull requests

- Explain the user-visible outcome.
- Link related issues.
- Confirm build, tests, and audit pass.
- Avoid unrelated formatting or refactoring.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
