import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const VALID_TEMPLATE = '<!DOCTYPE html><html><head>{%- auth0:head -%}</head><body>{%- auth0:widget -%}</body></html>';

/**
 * Writes a minimal a0deploy export to a temp dir.
 *
 * @param {{ template?: string, partials?: Record<string, Record<string, Record<string, string>>>, forms?: object[], flows?: object[] }} spec
 *   partials: { prompt: { screen: { slot: body } } }; forms/flows: documents in export format
 */
export async function makeTenant({ template, partials, forms, flows } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'auth0-preflight-'));

    if (template !== undefined) {
        const dir = path.join(root, 'branding', 'templates');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'universal_login.json'), JSON.stringify({ template: 'universal_login', body: './universal_login.html' }));
        await writeFile(path.join(dir, 'universal_login.html'), template);
    }

    if (partials) {
        const index = {};
        for (const [prompt, screens] of Object.entries(partials)) {
            index[prompt] = [{}];
            for (const [screen, slots] of Object.entries(screens)) {
                index[prompt][0][screen] = [];
                const dir = path.join(root, 'prompts', 'partials', prompt, screen);
                await mkdir(dir, { recursive: true });
                for (const [slot, body] of Object.entries(slots)) {
                    await writeFile(path.join(dir, `${slot}.liquid`), body);
                    index[prompt][0][screen].push({ name: slot, template: `partials/${prompt}/${screen}/${slot}.liquid` });
                }
            }
        }
        await writeFile(path.join(root, 'prompts', 'partials.json'), JSON.stringify(index, null, 2));
    }

    for (const [dir, docs] of [['forms', forms], ['flows', flows]]) {
        if (!docs) {
            continue;
        }
        await mkdir(path.join(root, dir), { recursive: true });
        for (const doc of docs) {
            await writeFile(path.join(root, dir, `${doc.name}.json`), JSON.stringify(doc, null, 2));
        }
    }

    return root;
}

/** Pads a valid template with an ASCII HTML comment until it is exactly `chars` long. */
export function templateOfSize(chars) {
    const filler = chars - VALID_TEMPLATE.length - '<!---->'.length;
    return VALID_TEMPLATE.replace('<body>', `<body><!--${'x'.repeat(filler)}-->`);
}
