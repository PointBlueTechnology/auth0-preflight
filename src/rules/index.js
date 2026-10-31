import templateSize from './template-size.js';
import templateRequiredTags from './template-required-tags.js';
import partialSize from './partial-size.js';
import flowSecurityAllowFailure from './flow-security-allow-failure.js';
import formJumpToEnding from './form-jump-to-ending.js';

/** @type {import('../types.js').Rule[]} */
export const rules = [templateSize, templateRequiredTags, partialSize, flowSecurityAllowFailure, formJumpToEnding];
