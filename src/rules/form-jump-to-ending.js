import { lineOfId } from '../loader.js';

/**
 * A Jump button that goes straight to `$ending` finishes the form without validating or
 * submitting the fields on its step. That's the usual way to build Cancel, but whatever runs
 * after the form (an Action's `onContinuePostLogin`, a resumed flow) receives none of those
 * fields, even required ones, and has to treat that as a cancel rather than a submission.
 */
const ENDING = '$ending';

/** @type {import('../types.js').Rule} */
export default {
    id: 'form-jump-to-ending',
    description: 'Jump buttons to the form ending skip validation and submit none of the step\'s fields',
    severity: 'warning',
    options: {
        // Component ids to skip once the caller is known to handle the missing fields.
        ignore: [],
    },
    check(tenant, { ignore }) {
        const findings = [];
        for (const { file, text, data } of tenant.forms) {
            for (const node of data.nodes ?? []) {
                const components = node.type === 'STEP' ? node.config?.components ?? [] : [];
                const fields = components.filter(c => c.category === 'FIELD');
                if (fields.length === 0) {
                    continue;
                }

                for (const button of components) {
                    if (button.type !== 'JUMP_BUTTON' || button.config?.next_node !== ENDING || ignore.includes(button.id)) {
                        continue;
                    }
                    const required = fields.filter(f => f.required);
                    const skipped = (required.length ? required : fields).map(f => f.id);
                    const noun = `${required.length ? 'required ' : ''}field${skipped.length === 1 ? '' : 's'}`;
                    findings.push({
                        file,
                        line: lineOfId(text, button.id),
                        message:
                            `Form "${data.name}" step "${node.id}": "${button.config.text ?? button.id}" jumps to the ending, ` +
                            `so ${noun} ${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} neither validated nor submitted. ` +
                            'Make sure whatever runs after the form handles that.',
                    });
                }
            }
        }
        return findings;
    },
};
