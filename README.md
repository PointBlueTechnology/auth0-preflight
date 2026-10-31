# auth0-preflight

Catch Auth0 Universal Login problems in CI, before a deploy fails halfway through.

Auth0 enforces limits on page templates and partials, but you only find out when the Management API rejects the deploy. With [a0deploy](https://github.com/auth0/auth0-deploy-cli) or Terraform, that's often after the rest of the tenant has already changed. `auth0-preflight` reads your exported tenant configuration and checks those limits on the pull request instead.

```bash
npx auth0-preflight ./tenant
```

```
branding/templates/universal_login.html
  error   Page template is 103,212 of 102,400 characters; Auth0 will reject it. Move screen-specific CSS or JS into partials.  [template-size]

1 error, 0 warnings
```

## Rules

| Rule | Default | Checks |
|---|---|---|
| `template-size` | error | The page template is at most 102,400 characters, and warns within 4,096 of the limit. |
| `template-required-tags` | error | The page template has exactly one `{%- auth0:head -%}` and at least one `{%- auth0:widget -%}`. |
| `partial-size` | error | Each partial slot (for example `form-content-end`) is at most 10,000 characters. The limit is per slot, not per screen. |
| `flow-security-allow-failure` | warning | Flow steps that revoke access (deleting sessions, refresh tokens, grants or MFA enrolments) or block a user don't set `allow_failure: true`. Otherwise a failed revocation lets the flow carry on as if it had worked. |
| `form-jump-to-ending` | warning | Flags Jump buttons that go straight to the form's ending from a step with fields. That's the usual way to build Cancel, but it skips validation and submits none of the step's fields, even required ones, so whatever runs after the form must handle that. |

Both Forms and Flows rules take an `ignore` list of step or component ids for cases you've checked: `"form-jump-to-ending": ["warning", { "ignore": ["cancel"] }]`.

### How the limits are counted

Each limit was measured against a live tenant through the Management API, and the tests reproduce those results. The two limits count "characters" differently:

| Limit | Counted as | Accepted | Rejected |
|---|---|---|---|
| Page template, 102,400 | Unicode code points | 102,400 × `é` (204,701 bytes); 51,251 emoji | 102,401 × `é` |
| Partial slot, 10,000 | UTF-16 units (JavaScript `length`) | 5,000 emoji | 5,001 emoji |

For ASCII-only markup, bytes, code points and UTF-16 units are all the same. The difference only shows with accented text or emoji. Auth0's error for an oversized template doesn't mention size ("Data does not match any schemas from 'oneOf'"), which is why this check exists.

## Input

Point it at an a0deploy **directory** export:

```
tenant/
  branding/templates/universal_login.json   # { "body": "./universal_login.html" }
  branding/templates/universal_login.html
  prompts/partials.json                     # prompt -> screen -> [{ name, template }]
  prompts/partials/<prompt>/<screen>/<slot>.liquid
  forms/*.json
  flows/*.json
```

[`examples/change-email`](examples/change-email) is a real a0deploy export of a change-email form and flow that trips both Forms and Flows rules. Run it with `npm run example`.

Missing pieces are skipped, so a repo that manages only some resources still works.

## Configuration

Optional `.auth0-preflight.json` in the target directory, or `--config <file>`:

```json
{
  "rules": {
    "template-size": ["error", { "warnWithinChars": 8192 }],
    "partial-size": "warning",
    "template-required-tags": "off"
  }
}
```

## CI

In GitHub Actions the output switches to annotations automatically, so findings appear on the changed files in the PR:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx auth0-preflight ./tenant --max-warnings 0
```

Exit codes: `0` clean, `1` errors (or more warnings than `--max-warnings`), `2` the tool itself failed.

## Limitations

- a0deploy keyword replacement (`##KEY##` / `@@KEY@@`) runs at deploy time, so a template that uses it is measured before replacement.
- Terraform (`auth0_branding`) input isn't supported yet.

## Development

```bash
npm test
```

No runtime dependencies; Node 20 or later.

## License

MIT

Auth0 is a trademark of Okta, Inc. This is an independent project, not affiliated with or endorsed by Okta.
