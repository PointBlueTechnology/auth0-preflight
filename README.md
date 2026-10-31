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
| `form-jump-skips-fields` | warning | Flags Jump buttons on a step with fields. A Jump button leaves its step without validating or submitting that step's fields, even required or filled-in ones, wherever it goes. A jump to the ending is the usual way to build Cancel, so whatever runs after the form must treat missing fields as a cancel. A jump to another step loses what the customer typed. |

Both Forms and Flows rules take an `ignore` list of step or component ids for cases you've checked: `"form-jump-skips-fields": ["warning", { "ignore": ["cancel"] }]`.

### How the rules were tested

The size limits, template tags and Jump button behaviour were tested on a live tenant, and the unit tests reproduce those results. (`flow-security-allow-failure` follows Auth0's documented meaning of `allow_failure`.)

**Size limits.** Measured through the Management API. The two limits count "characters" differently:

| Limit | Counted as | Accepted | Rejected |
|---|---|---|---|
| Page template, 102,400 | Unicode code points | 102,400 × `é` (204,701 bytes); 51,251 emoji | 102,401 × `é` |
| Partial slot, 10,000 | UTF-16 units (JavaScript `length`) | 5,000 emoji | 5,001 emoji |

For ASCII-only markup, bytes, code points and UTF-16 units are all the same. The difference only shows with accented text or emoji. Auth0's error for an oversized template doesn't mention size ("Data does not match any schemas from 'oneOf'"), which is why this check exists.

**Template tags.** A second `auth0:head` is rejected; a second `auth0:widget` is accepted.

**Jump buttons.** A post-login Action recorded what a live form handed back for a step with a required email and an optional note:

| Button pressed on step 1 | Fields received |
|---|---|
| Cancel (jump to the ending), fields empty | none, and the required email wasn't checked |
| Cancel, both fields filled in | none |
| Skip (jump to step 2), then Finish | only step 2's field |
| Next (normal submit) | both step 1 fields |

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

### GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: PointBlueTechnology/auth0-preflight@v0.1.0
  with:
    path: tenant          # the a0deploy export; default .
    max-warnings: 0       # optional; empty means warnings never fail
    # config: .auth0-preflight.json
```

Findings appear as annotations on the changed files in the pull request. The action needs Node.js 20 or later on the runner. GitHub-hosted runners have it; on a self-hosted runner, add `actions/setup-node` first.

### Anywhere else

```bash
npx auth0-preflight ./tenant --max-warnings 0
```

Inside GitHub Actions the output switches to annotations automatically.

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
