import { lineOfId } from '../loader.js';

/**
 * A Jump button leaves its step without validating or submitting the step's fields, wherever it
 * jumps to. Measured against a live tenant, with a required email and an optional note on step 1:
 *
 * - Cancel (jump to `$ending`), fields empty or filled in: the Action resumed with `fields: {}`.
 * - Skip (jump to step 2), then Finish: only step 2's field arrived; step 1's were gone.
 * - Next (normal submit): both step 1 fields arrived.
 *
 * Jumping to `$ending` is the usual way to build Cancel, and that's fine as long as whatever runs
 * after the form (an Action's `onContinuePostLogin`, a resumed flow) treats the missing fields as a
 * cancel. A jump to another step is more likely a bug: the customer filled in fields that vanish.
 */
const ENDING = '$ending';

/** @type {import('../types.js').Rule} */
export default {
    id: 'form-jump-skips-fields',
    description: 'Jump buttons leave their step without validating or submitting its fields',
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
                    if (button.type !== 'JUMP_BUTTON' || ignore.includes(button.id)) {
                        continue;
                    }
                    const target = button.config?.next_node;
                    const required = fields.filter(f => f.required);
                    const skipped = (required.length ? required : fields).map(f => f.id);
                    const noun = `${required.length ? 'required ' : ''}field${skipped.length === 1 ? '' : 's'}`;
                    const where = target === ENDING ? 'jumps to the ending' : `jumps to "${target}"`;
                    const consequence =
                        target === ENDING
                            ? 'Make sure whatever runs after the form treats that as a cancel.'
                            : 'They never reach later steps or whatever runs after the form.';
                    findings.push({
                        file,
                        line: lineOfId(text, button.id),
                        message:
                            `Form "${data.name}" step "${node.id}": "${button.config?.text ?? button.id}" ${where}, ` +
                            `so ${noun} ${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} neither validated nor submitted. ` +
                            consequence,
                    });
                }
            }
        }
        return findings;
    },
};
