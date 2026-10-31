import { test } from 'node:test';
import assert from 'node:assert/strict';
import { github, text } from '../src/reporters/index.js';

const finding = { rule: 'template-size', severity: 'error', file: '/repo/branding/templates/universal_login.html', message: 'Too big: 100%\nreally' };

test('github: emits an annotation with escaped data', () => {
    assert.equal(
        github([finding], '/repo'),
        '::error file=branding/templates/universal_login.html,title=template-size::Too big: 100%25%0Areally',
    );
});

test('github: escapes property separators in file paths', () => {
    const out = github([{ ...finding, file: '/repo/a,b:c.html' }], '/repo');
    assert.match(out, /file=a%2Cb%3Ac\.html/);
});

test('text: summarises counts', () => {
    const out = text([finding, { ...finding, severity: 'warning' }], '/repo');
    assert.match(out, /1 error, 1 warning$/);
});

test('text: says so when clean', () => {
    assert.equal(text([]), 'auth0-preflight: no problems found');
});
