/**
 * Shared shapes. JSDoc only; nothing here runs.
 *
 * @typedef {'error' | 'warning' | 'off'} Severity
 *
 * @typedef {object} Tenant
 * @property {string} root
 * @property {{ file: string, body: string } | null} template  Universal Login page template
 * @property {Partial[]} partials
 * @property {JsonDoc[]} forms  `forms/*.json`
 * @property {JsonDoc[]} flows  `flows/*.json`
 *
 * @typedef {object} JsonDoc
 * @property {string} file
 * @property {string} text  raw file contents, for line numbers
 * @property {any} data
 *
 * @typedef {object} Partial
 * @property {string} prompt  e.g. `signup`
 * @property {string} screen  e.g. `signup`
 * @property {string} slot    insertion point, e.g. `form-content-end`
 * @property {string} file
 * @property {string} body
 *
 * @typedef {object} Finding
 * @property {string} rule
 * @property {Exclude<Severity, 'off'>} severity
 * @property {string} message
 * @property {string} [file]
 * @property {number} [line]
 *
 * @typedef {object} Rule
 * @property {string} id
 * @property {string} description  one line, shown by `--list-rules`
 * @property {Exclude<Severity, 'off'>} severity  default severity
 * @property {Record<string, unknown>} [options]  defaults, overridable from config
 * @property {(tenant: Tenant, options: Record<string, any>) => Omit<Finding, 'rule' | 'severity'>[] | Promise<Omit<Finding, 'rule' | 'severity'>[]>} check
 */

export {};
