// Zip reader for NSE archives (stored or deflate). Uses DecompressionStream, available in Workers and Node >= 18.

export interface ZipEntry {
  name: string;
  read(): Promise<Uint8Array>;
}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

export function readZip(bytes: Uint8Array): ZipEntry[] {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip: end of central directory not found");
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error("zip: bad central directory");
    const method = u16(bytes, p + 10);
    const csize = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    out.push({
      name,
      read: async () => {
        if (u32(bytes, local) !== 0x04034b50) throw new Error(`zip: bad local header for ${name}`);
        const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
        const data = bytes.subarray(start, start + csize);
        if (method === 0) return data.slice();
        if (method !== 8) throw new Error(`zip: unsupported method ${method} for ${name}`);
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      },
    });
  }
  return out;
}

/** First entry whose base name matches (case-insensitive). NSE changes name case and date format across years. */
export function findEntry(entries: readonly ZipEntry[], pattern: RegExp): ZipEntry | undefined {
  return entries.find((e) => pattern.test(e.name.split("/").pop() ?? e.name));
}
