#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { preflight, rules } from '../src/index.js';
import { reporters } from '../src/reporters/index.js';

const USAGE = `Usage: auth0-preflight [dir] [options]

Checks an Auth0 Deploy CLI (a0deploy) directory export before you deploy it.

Options:
  -f, --format <text|github|json>  output format (default: text, or github inside GitHub Actions)
  -c, --config <file>              config file (default: <dir>/.auth0-preflight.json if present)
      --max-warnings <n>           fail when there are more than n warnings
      --list-rules                 print the rules and exit
  -h, --help                       show this help`;

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            format: { type: 'string', short: 'f' },
            config: { type: 'string', short: 'c' },
            'max-warnings': { type: 'string' },
            'list-rules': { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });

    if (values.help) {
        console.log(USAGE);
        return 0;
    }
    if (values['list-rules']) {
        for (const rule of rules) {
            console.log(`${rule.id.padEnd(28)} ${rule.severity.padEnd(8)} ${rule.description}`);
        }
        return 0;
    }

    const root = path.resolve(positionals[0] ?? '.');
    const format = values.format ?? (process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'text');
    const report = reporters[format];
    if (!report) {
        throw new Error(`unknown format "${format}"`);
    }

    const config = await loadConfig(values.config ?? path.join(root, '.auth0-preflight.json'), Boolean(values.config));
    const findings = await preflight(root, config);
    const output = report(findings);
    if (output) {
        console.log(output);
    }

    const errors = findings.filter(f => f.severity === 'error').length;
    const warnings = findings.length - errors;
    const maxWarnings = values['max-warnings'] === undefined ? Infinity : Number(values['max-warnings']);
    return errors > 0 || warnings > maxWarnings ? 1 : 0;
}

async function loadConfig(file, required) {
    try {
        return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT' && !required) {
            return {};
        }
        throw new Error(`${file}: ${err.message}`);
    }
}

main().then(
    code => process.exit(code),
    err => {
        console.error(`auth0-preflight: ${err.message}`);
        process.exit(2);
    },
);
