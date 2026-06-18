/**
 * Build a URL relative to the site's base path.
 *
 * The site deploys under a project Pages base (`/propr-report`), so root-relative
 * URLs like `/data/cumulative.json` 404 in production. Route every asset, data
 * fetch, and internal link through this helper, which prefixes the configured
 * `import.meta.env.BASE_URL` and normalizes slashes so the result never has a
 * double or missing `/`.
 *
 * @example
 *   dataUrl('/data/cumulative.json') // '/propr-report/data/cumulative.json'
 *   dataUrl('about')                 // '/propr-report/about'
 *   dataUrl('/')                     // '/propr-report/'
 */
export function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL; // e.g. '/propr-report' or '/'
  const trimmedBase = base.replace(/\/+$/, ''); // drop trailing slashes
  const trimmedPath = path.replace(/^\/+/, ''); // drop leading slashes
  if (trimmedPath === '') {
    // Caller asked for the base itself (e.g. the home page). Keep a trailing slash.
    return `${trimmedBase}/`;
  }
  return `${trimmedBase}/${trimmedPath}`;
}
