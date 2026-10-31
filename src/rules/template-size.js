/**
 * Auth0 rejects a Universal Login page template over 102,400 characters. The deploy fails at
 * the branding step, often after everything else has already been applied, and the API's
 * error ("Data does not match any schemas from 'oneOf'") doesn't mention size.
 *
 * Measured against a live tenant: the limit counts Unicode code points, not UTF-8 bytes and
 * not UTF-16 units. 102,400 "é" (204,701 bytes) is accepted, and so are 51,251 emoji
 * (102,402 UTF-16 units). For ASCII-only templates all three counts are the same.
 */
export const TEMPLATE_MAX_CHARS = 102_400;

/** @type {import('../types.js').Rule} */
export default {
    id: 'template-size',
    description: 'Universal Login page template must stay under the 102,400-character limit',
    severity: 'error',
    options: {
        maxChars: TEMPLATE_MAX_CHARS,
        // Warn once the template is within this many characters of the limit.
        warnWithinChars: 4096,
    },
    check(tenant, { maxChars, warnWithinChars }) {
        if (!tenant.template) {
            return [];
        }

        const { file, body } = tenant.template;
        const chars = countCodePoints(body);
        const used = `${chars.toLocaleString('en-US')} of ${maxChars.toLocaleString('en-US')} characters`;

        if (chars > maxChars) {
            return [{ file, message: `Page template is ${used}; Auth0 will reject it. Move screen-specific CSS or JS into partials.` }];
        }
        if (chars > maxChars - warnWithinChars) {
            return [{ file, severity: 'warning', message: `Page template is ${used} (${(maxChars - chars).toLocaleString('en-US')} left).` }];
        }
        return [];
    },
};

function countCodePoints(s) {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}
