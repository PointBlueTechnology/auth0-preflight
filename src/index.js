import { loadTenant } from './loader.js';
import { rules as builtInRules } from './rules/index.js';

/**
 * Runs every enabled rule against an a0deploy directory export.
 *
 * `config.rules` maps a rule id to a severity (`'error' | 'warning' | 'off'`) or to
 * `[severity, options]`, ESLint-style.
 *
 * @param {string} root
 * @param {{ rules?: Record<string, any> }} [config]
 * @returns {Promise<import('./types.js').Finding[]>}
 */
export async function preflight(root, config = {}, rules = builtInRules) {
    const tenant = await loadTenant(root);
    const findings = [];

    for (const rule of rules) {
        const { severity, options } = resolve(rule, config.rules?.[rule.id]);
        if (severity === 'off') {
            continue;
        }

        for (const finding of await rule.check(tenant, options)) {
            // A rule may downgrade a finding to a warning (e.g. "close to the limit");
            // it never escalates past the configured severity.
            const level = finding.severity === 'warning' || severity === 'warning' ? 'warning' : 'error';
            findings.push({ ...finding, rule: rule.id, severity: level });
        }
    }

    return findings;
}

function resolve(rule, setting) {
    const [severity, overrides] = Array.isArray(setting) ? setting : [setting, undefined];
    return {
        severity: severity ?? rule.severity,
        options: { ...rule.options, ...overrides },
    };
}

export { builtInRules as rules };
