import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../src/index.js';
import { TEMPLATE_MAX_CHARS } from '../src/rules/template-size.js';
import { PARTIAL_MAX_CHARS } from '../src/rules/partial-size.js';
import { makeTenant, templateOfSize, VALID_TEMPLATE } from './helpers.js';

const only = (findings, rule) => findings.filter(f => f.rule === rule);

test('an empty export has nothing to report', async () => {
    assert.deepEqual(await preflight(await makeTenant()), []);
});

test('template-size: exactly at the limit passes with a warning', async () => {
    const root = await makeTenant({ template: templateOfSize(TEMPLATE_MAX_CHARS) });
    const [finding, ...rest] = only(await preflight(root), 'template-size');
    assert.equal(rest.length, 0);
    assert.equal(finding.severity, 'warning');
    assert.match(finding.message, /0 left/);
});

test('template-size: one character over is an error', async () => {
    const root = await makeTenant({ template: templateOfSize(TEMPLATE_MAX_CHARS + 1) });
    const [finding] = only(await preflight(root), 'template-size');
    assert.equal(finding.severity, 'error');
    assert.match(finding.message, /102,401 of 102,400 characters/);
});

// The cases below mirror what a live tenant accepted and rejected.
const padded = pad => VALID_TEMPLATE.replace('<body>', `<body><!--${pad}-->`);
const overhead = VALID_TEMPLATE.length + '<!---->'.length;

test('template-size: counts characters, not UTF-8 bytes (102,400 "é" is accepted)', async () => {
    const root = await makeTenant({ template: padded('é'.repeat(TEMPLATE_MAX_CHARS - overhead)) });
    const [finding] = only(await preflight(root), 'template-size');
    assert.equal(finding.severity, 'warning');
});

test('template-size: counts code points, not UTF-16 units (51,251 emoji is accepted)', async () => {
    const emoji = '\u{1F600}'.repeat(51_201);
    assert.ok(emoji.length > TEMPLATE_MAX_CHARS); // over the limit if counted as string.length
    const root = await makeTenant({ template: padded(emoji) });
    assert.deepEqual(only(await preflight(root), 'template-size'), []);
});

test('template-size: 102,401 "é" is rejected', async () => {
    const root = await makeTenant({ template: padded('é'.repeat(TEMPLATE_MAX_CHARS - overhead + 1)) });
    const [finding] = only(await preflight(root), 'template-size');
    assert.equal(finding.severity, 'error');
});

test('template-size: well under the limit is silent', async () => {
    const root = await makeTenant({ template: VALID_TEMPLATE });
    assert.deepEqual(only(await preflight(root), 'template-size'), []);
});

test('template-size: options and severity come from config', async () => {
    const root = await makeTenant({ template: templateOfSize(2000) });
    const findings = await preflight(root, { rules: { 'template-size': ['warning', { maxChars: 1000 }] } });
    assert.equal(only(findings, 'template-size')[0].severity, 'warning');

    const off = await preflight(root, { rules: { 'template-size': 'off' } });
    assert.deepEqual(only(off, 'template-size'), []);
});

test('template-required-tags: accepts tags with or without whitespace control', async () => {
    const root = await makeTenant({ template: '<html><head>{% auth0:head %}</head><body>{%- auth0:widget -%}</body></html>' });
    assert.deepEqual(only(await preflight(root), 'template-required-tags'), []);
});

test('template-required-tags: reports each missing tag', async () => {
    const root = await makeTenant({ template: '<html><head></head><body></body></html>' });
    const messages = only(await preflight(root), 'template-required-tags').map(f => f.message);
    assert.equal(messages.length, 2);
    assert.match(messages[0], /auth0:head/);
    assert.match(messages[1], /auth0:widget/);
});

test('partial-size: the limit is per slot', async () => {
    const nearlyFull = 'x'.repeat(PARTIAL_MAX_CHARS - 1);
    const root = await makeTenant({
        partials: { signup: { signup: { 'form-content-start': nearlyFull, 'form-content-end': nearlyFull } } },
    });
    const findings = only(await preflight(root), 'partial-size');
    assert.equal(findings.length, 2);
    assert.ok(findings.every(f => f.severity === 'warning'));
});

test('template-required-tags: a second auth0:head is an error, a second widget is fine', async () => {
    const twoHeads = VALID_TEMPLATE.replace('</head>', '{%- auth0:head -%}</head>');
    const [finding, ...rest] = only(await preflight(await makeTenant({ template: twoHeads })), 'template-required-tags');
    assert.equal(rest.length, 0);
    assert.match(finding.message, /2 auth0:head tags/);

    const twoWidgets = VALID_TEMPLATE.replace('</body>', '{%- auth0:widget -%}</body>');
    assert.deepEqual(only(await preflight(await makeTenant({ template: twoWidgets })), 'template-required-tags'), []);
});

test('partial-size: counts UTF-16 units (5,000 emoji pass, 5,001 fail)', async () => {
    const at = await makeTenant({ partials: { 'login-id': { 'login-id': { 'form-content-end': '\u{1F600}'.repeat(5_000) } } } });
    assert.ok(only(await preflight(at), 'partial-size').every(f => f.severity === 'warning'));

    const over = await makeTenant({ partials: { 'login-id': { 'login-id': { 'form-content-end': '\u{1F600}'.repeat(5_001) } } } });
    assert.equal(only(await preflight(over), 'partial-size')[0].severity, 'error');
});

test('partial-size: one character over is an error naming the slot', async () => {
    const root = await makeTenant({
        partials: { 'login-id': { 'login-id': { 'form-footer-end': 'x'.repeat(PARTIAL_MAX_CHARS + 1) } } },
    });
    const [finding] = only(await preflight(root), 'partial-size');
    assert.equal(finding.severity, 'error');
    assert.match(finding.message, /login-id\/login-id form-footer-end/);
});
