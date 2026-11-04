// Read-only diagnostic pages (status, census, checks) scan large tables, and their addresses are in this public repo, so
// anyone calling them spent D1 reads (audit 4 Nov). They answer only with `Authorization: Bearer <STATUS_TOKEN>`
// (Worker secret, set by the deploy workflow from the GitHub secret of the same name). No token configured = closed.

/** Constant-time comparison of two strings (no early exit on the first differing character). */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function statusAuthorized(req: { headers: { get(name: string): string | null } }, token: string | undefined): boolean {
  if (!token) return false;
  return same(req.headers.get("authorization") ?? "", `Bearer ${token}`);
}

export const FORBIDDEN_TEXT = "forbidden: diagnostic pages need the status token (Authorization: Bearer …)";
