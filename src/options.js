// @ts-check
/** Option definitions, defaults, flag parsing and feature derivation. */

/** Selectable values per option. Single-value options list their only choice for now. */
export const CHOICES = {
  mobile: ['ios', 'android'],
  cloud: ['aliyun'],
  db: ['supabase'],
  release: ['release-please'],
  secrets: ['infisical', 'env'],
};

/**
 * @typedef {object} Options
 * @property {string[]} mobile
 * @property {boolean} web
 * @property {boolean} design
 * @property {string} cloud
 * @property {string} db
 * @property {string} release
 * @property {string[]} secrets
 * @property {string} name
 * @property {string} prefix
 */

/** @returns {Options} */
export function defaults(dirName = 'my-app') {
  const name = toPascal(dirName) || 'MyApp';
  return {
    mobile: ['ios', 'android'],
    web: false,
    design: true,
    cloud: 'aliyun',
    db: 'supabase',
    release: 'release-please',
    secrets: ['infisical', 'env'],
    name,
    prefix: toPrefix(name),
  };
}

/** @param {string} s */
export function toPascal(s) {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** @param {string} s */
export function toSlug(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .join('-')
    .toLowerCase();
}

/** @param {string} s */
export function toPrefix(s) {
  return toSlug(s).replaceAll('-', '_').toUpperCase();
}

/**
 * Parses a comma list and validates every item.
 * @param {string} key
 * @param {string} value
 */
export function parseList(key, value) {
  if (value === '' || value === 'none') return [];
  const items = value.split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = CHOICES[/** @type {keyof typeof CHOICES} */ (key)];
  for (const item of items) {
    if (!allowed.includes(item)) throw new Error(`--${key}: unknown value "${item}", expected one of ${allowed.join(', ')}`);
  }
  return [...new Set(items)];
}

/**
 * @param {string} key
 * @param {string} value
 */
export function parseOne(key, value) {
  const allowed = CHOICES[/** @type {keyof typeof CHOICES} */ (key)];
  if (!allowed.includes(value)) throw new Error(`--${key}: unknown value "${value}", expected one of ${allowed.join(', ')}`);
  return value;
}

/**
 * Derives the feature set used by conditional markers.
 * @param {Options} o
 */
export function features(o) {
  const f = new Set([...o.mobile, ...o.secrets, o.cloud, o.db, o.release]);
  if (o.mobile.length) f.add('mobile');
  if (o.web) f.add('web');
  if (o.design) f.add('design');
  return f;
}
