// B2 provenance & time (D32, D35, D48): fields every stored value carries (§2a schema rules).

export type Origin = "reported" | "computed" | "extracted" | "industry_default" | "estimate";
export type Access = "public" | "signed_in" | "owner";
export type Basis = "consolidated" | "standalone";
export type Version = "original" | "restated" | "corrected";

export interface SourceRef {
  kind: "file" | "filing" | "xbrl" | "pdf_page" | "announcement";
  ref: string;            // url, filing id, seq id
  locator?: string;       // XBRL tag, page number, row key
  quote?: string;
}

export interface Provenance {
  period?: string;        // what the value is about
  disclosedAt: string;    // UTC ISO, when the market learned it
  basis?: Basis;
  version: Version;
  supersedes?: string;
  source: SourceRef;
  origin: Origin;
  access: Access;
  extractorVersion: string;
  model?: string;
}

/** A value that is either present or null with a reason (D52: never a sentinel). */
export type Maybe<T> = { ok: true; value: T } | { ok: false; reason: string };
export const some = <T>(value: T): Maybe<T> => ({ ok: true, value });
export const none = <T = never>(reason: string): Maybe<T> => ({ ok: false, reason });
