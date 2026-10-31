import path from 'node:path';

/** @typedef {import('../types.js').Finding} Finding */

/** @param {Finding[]} findings */
export function text(findings, cwd = process.cwd()) {
    if (findings.length === 0) {
        return 'auth0-preflight: no problems found';
    }
    const lines = findings.map(f => {
        const where = f.file ? `${path.relative(cwd, f.file)}${f.line ? `:${f.line}` : ''}` : '(tenant)';
        return `${where}\n  ${f.severity.padEnd(7)} ${f.message}  [${f.rule}]`;
    });
    return [...lines, '', summary(findings)].join('\n');
}

/**
 * GitHub Actions workflow commands, so findings show as annotations on the PR.
 * https://docs.github.com/actions/reference/workflow-commands-for-github-actions
 *
 * @param {Finding[]} findings
 */
export function github(findings, cwd = process.cwd()) {
    return findings
        .map(f => {
            const props = [f.file && `file=${escapeProperty(path.relative(cwd, f.file))}`, f.line && `line=${f.line}`, `title=${escapeProperty(f.rule)}`]
                .filter(Boolean)
                .join(',');
            return `::${f.severity} ${props}::${escapeData(f.message)}`;
        })
        .join('\n');
}

/** @param {Finding[]} findings */
export function json(findings) {
    return JSON.stringify(findings, null, 2);
}

function summary(findings) {
    const errors = findings.filter(f => f.severity === 'error').length;
    const warnings = findings.length - errors;
    return `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
}

const escapeData = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = s => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

export const reporters = { text, github, json };
