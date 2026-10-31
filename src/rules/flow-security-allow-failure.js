import { lineOfId } from '../loader.js';

/**
 * A Flow step with `allow_failure: true` lets the flow carry on when the step fails. That's
 * fine for a notification email, but not for a step whose job is to end access: if revoking
 * sessions or refresh tokens fails (a missing Management API scope, a rate limit), the flow
 * continues and the customer is told they've been signed out when they haven't.
 */
const REVOKE_PATH = /\/users\/[^/]+\/(sessions|refresh-tokens|authenticators|authentication-methods|multifactor)\b|\/(sessions|refresh-tokens|grants)\//;

/** @type {import('../types.js').Rule} */
export default {
    id: 'flow-security-allow-failure',
    description: 'Flow steps that revoke access or block a user should not set allow_failure',
    severity: 'warning',
    options: {
        // Step ids to skip, for cases where continuing after a failure is intended.
        ignore: [],
    },
    check(tenant, { ignore }) {
        const findings = [];
        for (const { file, text, data } of tenant.flows) {
            for (const step of walkSteps(data.actions)) {
                if (!step.allow_failure || ignore.includes(step.id)) {
                    continue;
                }
                const what = describeSecurityStep(step);
                if (what) {
                    findings.push({
                        file,
                        line: lineOfId(text, step.id),
                        message: `Flow "${data.name}" step "${step.id}" (${what}) has allow_failure: true. If it fails, the flow continues as if it had worked.`,
                    });
                }
            }
        }
        return findings;
    },
};

/** Steps nest under BOOLEAN_CONDITION `then` / `else` branches. */
function* walkSteps(steps = []) {
    for (const step of steps) {
        yield step;
        yield* walkSteps(step.params?.then);
        yield* walkSteps(step.params?.else);
    }
}

function describeSecurityStep(step) {
    if (step.type !== 'AUTH0') {
        return null;
    }
    const { params = {} } = step;
    if (step.action === 'SEND_REQUEST' && params.method?.toUpperCase() === 'DELETE' && REVOKE_PATH.test(params.pathname ?? '')) {
        return `DELETE ${params.pathname}`;
    }
    if (step.action === 'UPDATE_USER' && params.changes?.blocked !== undefined) {
        return 'updates "blocked"';
    }
    return null;
}
