/**
 * Auth0 only accepts a page template with exactly one `auth0:head` tag and at least one
 * `auth0:widget` tag (verified against a live tenant: a second head is rejected, a second
 * widget is not). The tags may use Liquid whitespace control (`{%- ... -%}`) or not.
 */
const tagPattern = name => new RegExp(`\\{%-?\\s*${name}\\s*-?%\\}`, 'g');

/** @type {import('../types.js').Rule} */
export default {
    id: 'template-required-tags',
    description: 'Universal Login page template must have one auth0:head and at least one auth0:widget',
    severity: 'error',
    check(tenant) {
        if (!tenant.template) {
            return [];
        }

        const { file, body } = tenant.template;
        const heads = body.match(tagPattern('auth0:head'))?.length ?? 0;
        const widgets = body.match(tagPattern('auth0:widget'))?.length ?? 0;

        const findings = [];
        if (heads === 0) {
            findings.push({ file, message: 'Page template is missing {%- auth0:head -%}; Auth0 will reject it.' });
        } else if (heads > 1) {
            findings.push({ file, message: `Page template has ${heads} auth0:head tags; Auth0 accepts exactly one.` });
        }
        if (widgets === 0) {
            findings.push({ file, message: 'Page template is missing {%- auth0:widget -%}; Auth0 will reject it.' });
        }
        return findings;
    },
};
