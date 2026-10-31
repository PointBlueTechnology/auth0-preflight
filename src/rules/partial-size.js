/**
 * Each partial insertion point (slot) holds at most 10,000 characters. The limit is per slot,
 * not per screen, so splitting markup across `form-content-start` and `form-content-end`
 * is a legitimate way to stay under it.
 *
 * Measured against a live tenant: unlike the page template, this limit counts UTF-16 units
 * (JavaScript `string.length`). 5,000 emoji (10,000 units) are accepted and 5,001 are not.
 */
export const PARTIAL_MAX_CHARS = 10_000;

/** @type {import('../types.js').Rule} */
export default {
    id: 'partial-size',
    description: 'Each prompt partial slot must stay under the 10,000-character limit',
    severity: 'error',
    options: {
        maxChars: PARTIAL_MAX_CHARS,
        warnWithinChars: 500,
    },
    check(tenant, { maxChars, warnWithinChars }) {
        const findings = [];
        for (const partial of tenant.partials) {
            const chars = partial.body.length;
            const where = `${partial.prompt}/${partial.screen} ${partial.slot}`;
            const used = `${chars.toLocaleString('en-US')} of ${maxChars.toLocaleString('en-US')} characters`;

            if (chars > maxChars) {
                findings.push({ file: partial.file, message: `Partial ${where} is ${used}; Auth0 will reject it.` });
            } else if (chars > maxChars - warnWithinChars) {
                findings.push({ file: partial.file, severity: 'warning', message: `Partial ${where} is ${used}.` });
            }
        }
        return findings;
    },
};
