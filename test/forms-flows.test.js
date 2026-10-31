import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../src/index.js';
import { makeTenant } from './helpers.js';

const only = (findings, rule) => findings.filter(f => f.rule === rule);

const revoke = (id, pathname, allowFailure) => ({
    id,
    type: 'AUTH0',
    action: 'SEND_REQUEST',
    allow_failure: allowFailure,
    mask_output: false,
    params: { connection_id: 'vault', method: 'DELETE', pathname },
});

const notify = { id: 'notify', type: 'AUTH0', action: 'SEND_EMAIL', allow_failure: true, params: { to: '{{context.user.email}}' } };

test('flow-security-allow-failure: flags revocation steps nested in a condition, with line numbers', async () => {
    const flow = {
        name: 'Change email',
        actions: [
            {
                id: 'changed',
                type: 'FLOW',
                action: 'BOOLEAN_CONDITION',
                params: {
                    then: [
                        notify,
                        revoke('revoke_sessions', '/api/v2/users/{{context.user.user_id}}/sessions', true),
                        revoke('revoke_tokens', '/api/v2/users/{{context.user.user_id}}/refresh-tokens', true),
                    ],
                    else: [revoke('revoke_grant', '/api/v2/grants/{{vars.grant}}', false)],
                },
            },
        ],
    };
    const findings = only(await preflight(await makeTenant({ flows: [flow] })), 'flow-security-allow-failure');

    assert.deepEqual(findings.map(f => f.message.match(/step "(\w+)"/)[1]), ['revoke_sessions', 'revoke_tokens']);
    assert.ok(findings.every(f => f.severity === 'warning' && Number.isInteger(f.line)));
    assert.match(findings[0].message, /DELETE \/api\/v2\/users\/\{\{context\.user\.user_id\}\}\/sessions/);
});

test('flow-security-allow-failure: flags blocking a user, ignores other updates and listed ids', async () => {
    const update = (id, changes) => ({ id, type: 'AUTH0', action: 'UPDATE_USER', allow_failure: true, params: { user_id: 'u', changes } });
    const flow = { name: 'Lock', actions: [update('block', { blocked: true }), update('rename', { name: 'x' }), update('known', { blocked: true })] };
    const root = await makeTenant({ flows: [flow] });

    const findings = only(await preflight(root, { rules: { 'flow-security-allow-failure': ['warning', { ignore: ['known'] }] } }), 'flow-security-allow-failure');
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /step "block" \(updates "blocked"\)/);
});

const form = (components, nextNode = '$ending') => ({
    name: 'Change email form',
    start: { next_node: 'step_1' },
    ending: { resume_flow: true },
    nodes: [{ id: 'step_1', type: 'STEP', config: { next_node: nextNode, components } }],
});
const email = { id: 'new_email', category: 'FIELD', type: 'EMAIL', label: 'Email', required: true, sensitive: false };
const jump = (id, next) => ({ id, category: 'BLOCK', type: 'JUMP_BUTTON', config: { text: 'Cancel', next_node: next } });

test('form-jump-to-ending: flags a jump to the ending on a step with fields', async () => {
    const root = await makeTenant({ forms: [form([email, jump('cancel', '$ending')])] });
    const [finding, ...rest] = only(await preflight(root), 'form-jump-to-ending');
    assert.equal(rest.length, 0);
    assert.equal(finding.severity, 'warning');
    assert.match(finding.message, /"Cancel" jumps to the ending, so required field new_email is neither validated nor submitted/);
    assert.ok(Number.isInteger(finding.line));
});

test('form-jump-to-ending: ignores jumps to other steps, steps without fields, and listed ids', async () => {
    const text = { id: 'intro', category: 'BLOCK', type: 'RICH_TEXT', config: { content: 'Hi' } };
    const forms = [
        { ...form([email, jump('back', 'step_0')]), name: 'a' },
        { ...form([text, jump('skip', '$ending')]), name: 'b' },
        { ...form([email, jump('cancel', '$ending')]), name: 'c' },
    ];
    const root = await makeTenant({ forms });
    const findings = only(await preflight(root, { rules: { 'form-jump-to-ending': ['warning', { ignore: ['cancel'] }] } }), 'form-jump-to-ending');
    assert.deepEqual(findings, []);
});
