import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

/**
 * Reads the parts of an Auth0 Deploy CLI (a0deploy) directory export that the rules check.
 * Anything missing is left out rather than treated as an error, so a repo that only manages
 * some resources still lints cleanly.
 *
 * @param {string} root directory that holds `branding/`, `prompts/`, `forms/`, `flows/`
 * @returns {Promise<import('./types.js').Tenant>}
 */
export async function loadTenant(root) {
    return {
        root,
        template: await loadTemplate(root),
        partials: await loadPartials(root),
        forms: await loadJsonDir(path.join(root, 'forms')),
        flows: await loadJsonDir(path.join(root, 'flows')),
    };
}

/** Every `*.json` in a directory, keeping the raw text so rules can report line numbers. */
async function loadJsonDir(dir) {
    let names;
    try {
        names = await readdir(dir);
    } catch {
        return [];
    }

    const docs = [];
    for (const name of names.filter(n => n.endsWith('.json')).sort()) {
        const file = path.join(dir, name);
        const text = await readFile(file, 'utf8');
        docs.push({ file, text, data: parseJson(file, text) });
    }
    return docs;
}

async function loadTemplate(root) {
    const dir = path.join(root, 'branding', 'templates');
    const meta = await readJson(path.join(dir, 'universal_login.json'));
    const file = path.join(dir, meta?.body ?? 'universal_login.html');
    const body = await readText(file);
    return body === null ? null : { file, body };
}

/**
 * `prompts/partials.json` maps prompt -> [ { screen: [ { name, template } ] } ], where
 * `template` is a path relative to `prompts/`.
 */
async function loadPartials(root) {
    const promptsDir = path.join(root, 'prompts');
    const index = await readJson(path.join(promptsDir, 'partials.json'));
    if (!index) {
        return [];
    }

    const partials = [];
    for (const [prompt, screens] of Object.entries(index)) {
        for (const screenGroup of asArray(screens)) {
            for (const [screen, slots] of Object.entries(screenGroup)) {
                for (const slot of asArray(slots)) {
                    const file = path.join(promptsDir, slot.template);
                    const body = await readText(file);
                    partials.push({ prompt, screen, slot: slot.name, file, body: body ?? '' });
                }
            }
        }
    }
    return partials;
}

const asArray = value => (Array.isArray(value) ? value : [value]);

async function readText(file) {
    try {
        await access(file);
    } catch {
        return null;
    }
    return readFile(file, 'utf8');
}

async function readJson(file) {
    const text = await readText(file);
    return text === null ? null : parseJson(file, text);
}

function parseJson(file, text) {
    try {
        return JSON.parse(text);
    } catch (err) {
        throw new Error(`${file}: invalid JSON (${err.message})`);
    }
}

/** 1-based line of the first `"id": "<id>"` in a JSON document, for annotations. */
export function lineOfId(text, id) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`"id"\\s*:\\s*"${escaped}"`).exec(text);
    return match ? text.slice(0, match.index).split('\n').length : undefined;
}
