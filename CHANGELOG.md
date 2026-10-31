# Changelog

## 0.1.0 (2026-10-31)

First release.

### Rules

- `template-size`: Universal Login page template at most 102,400 Unicode code points.
- `template-required-tags`: exactly one `auth0:head`, at least one `auth0:widget`.
- `partial-size`: each partial slot at most 10,000 UTF-16 units.
- `flow-security-allow-failure`: Flow steps that revoke access or block a user with `allow_failure: true`.
- `form-jump-skips-fields`: Jump buttons that leave a step without validating or submitting its fields.

The size limits, template tags and Jump button behaviour were tested on a live tenant; see the README.

### Usage

- CLI for a0deploy directory exports, with text, JSON and GitHub annotation output.
- ESLint-style config in `.auth0-preflight.json`.
- GitHub Action (`action.yml`).
