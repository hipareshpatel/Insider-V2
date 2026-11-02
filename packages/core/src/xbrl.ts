// Generic XBRL instance reader (D47 layer 1: every fact as filed, lossless). No DOM: runs in Workers.
// Reads contexts (entity, period, dimensions), units and every element carrying contextRef.

export interface XbrlContext {
  id: string;
  entity: string | null;
  start: string | null;
  end: string | null;
  instant: string | null;
  dims: Record<string, string>; // dimension -> member (explicit) or value (typed)
}
export interface XbrlFact { tag: string; contextRef: string; unitRef: string | null; decimals: string | null; value: string | null; nil: boolean }
export interface XbrlInstance { contexts: Map<string, XbrlContext>; units: Map<string, string>; facts: XbrlFact[]; schemaRef: string | null }

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
}
const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  return m ? decodeXml(m[2] ?? m[3] ?? "") : null;
};
const inner = (xml: string, local: string): string | null => {
  const m = new RegExp(`<(?:[\\w-]+:)?${local}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${local}>`).exec(xml);
  return m ? decodeXml(m[1]!.trim()) : null;
};

export function parseXbrl(xml: string): XbrlInstance {
  const contexts = new Map<string, XbrlContext>();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?context\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?context>/g)) {
    const id = attr(m[1]!, "id");
    if (!id) continue;
    const body = m[2]!;
    const dims: Record<string, string> = {};
    for (const d of body.matchAll(/<(?:[\w-]+:)?explicitMember\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?explicitMember>/g)) {
      const dim = attr(d[1]!, "dimension");
      if (dim) dims[dim] = decodeXml(d[2]!.trim());
    }
    for (const d of body.matchAll(/<(?:[\w-]+:)?typedMember\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?typedMember>/g)) {
      const dim = attr(d[1]!, "dimension");
      if (dim) dims[dim] = decodeXml(d[2]!.replace(/<[^>]+>/g, "").trim());
    }
    contexts.set(id, { id, entity: inner(body, "identifier"), start: inner(body, "startDate"), end: inner(body, "endDate"), instant: inner(body, "instant"), dims });
  }
  const units = new Map<string, string>();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?unit\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?unit>/g)) {
    const id = attr(m[1]!, "id");
    if (id) units.set(id, [...m[2]!.matchAll(/<(?:[\w-]+:)?measure>([\s\S]*?)<\/(?:[\w-]+:)?measure>/g)].map((x) => x[1]!.trim()).join("/"));
  }
  const facts: XbrlFact[] = [];
  // Facts: any element with contextRef. Self-closing (nil) or with content up to its own closing tag.
  const re = /<([\w-]+:[\w.-]+)\b([^>]*?\bcontextRef\s*=[^>]*?)(\/>|>([\s\S]*?)<\/\1\s*>)/g;
  for (const m of xml.matchAll(re)) {
    const a = m[2]!;
    const nil = /\bnil\s*=\s*["']true["']/.test(a) || m[3] === "/>";
    facts.push({ tag: m[1]!, contextRef: attr(a, "contextRef")!, unitRef: attr(a, "unitRef"), decimals: attr(a, "decimals"), value: nil ? null : decodeXml((m[4] ?? "").trim()), nil });
  }
  const sr = /<(?:[\w-]+:)?schemaRef\b([^>]*)>/.exec(xml);
  return { contexts, units, facts, schemaRef: sr ? attr(sr[1]!, "xlink:href") : null };
}
