import templateSize from './template-size.js';
import templateRequiredTags from './template-required-tags.js';
import partialSize from './partial-size.js';
import flowSecurityAllowFailure from './flow-security-allow-failure.js';
import formJumpSkipsFields from './form-jump-skips-fields.js';

/** @type {import('../types.js').Rule[]} */
export const rules = [templateSize, templateRequiredTags, partialSize, flowSecurityAllowFailure, formJumpSkipsFields];
