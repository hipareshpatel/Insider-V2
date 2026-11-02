// Tiny stored (uncompressed) zip writer for tests.
import { deflateRawSync } from "node:zlib";
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zipSync(name: string, text: string): Uint8Array {
  const data = new TextEncoder().encode(text);
  const comp = new Uint8Array(deflateRawSync(data));
  const nm = new TextEncoder().encode(name);
  const le = (n: number, w: number) => { const a = new Uint8Array(w); for (let i = 0; i < w; i++) a[i] = (n >>> (8 * i)) & 0xff; return a; };
  const crc = crc32(data);
  const local = [le(0x04034b50, 4), le(20, 2), le(0, 2), le(8, 2), le(0, 2), le(0, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), nm, comp];
  const localLen = local.reduce((n, a) => n + a.length, 0);
  const central = [le(0x02014b50, 4), le(20, 2), le(20, 2), le(0, 2), le(8, 2), le(0, 2), le(0, 2), le(crc, 4), le(comp.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(0, 4), nm];
  const centralLen = central.reduce((n, a) => n + a.length, 0);
  const end = [le(0x06054b50, 4), le(0, 2), le(0, 2), le(1, 2), le(1, 2), le(centralLen, 4), le(localLen, 4), le(0, 2)];
  const parts = [...local, ...central, ...end];
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
