import { getSavedFirmware, saveFirmware } from "./firmware-cache";

/** Parse Intel HEX into a contiguous image starting at the lowest address. */
export function parseIntelHex(text: string): { data: Uint8Array; start: number } {
  const chunks: { addr: number; bytes: number[] }[] = [];
  let base = 0;
  let min = Infinity;
  let max = 0;

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (!line) continue;
    if (line[0] !== ":") throw new Error(`HEX line ${ln + 1}: missing ':'`);
    const b: number[] = [];
    for (let i = 1; i < line.length; i += 2) b.push(parseInt(line.substr(i, 2), 16));
    const len = b[0];
    const off = (b[1] << 8) | b[2];
    const type = b[3];
    const sum = b.reduce((a, v) => (a + v) & 0xff, 0);
    if (sum !== 0) throw new Error(`HEX line ${ln + 1}: bad checksum`);
    const payload = b.slice(4, 4 + len);

    if (type === 0x00) {
      const addr = base + off;
      chunks.push({ addr, bytes: payload });
      min = Math.min(min, addr);
      max = Math.max(max, addr + len);
    } else if (type === 0x01) {
      break;
    } else if (type === 0x02) {
      base = ((payload[0] << 8) | payload[1]) << 4;
    } else if (type === 0x04) {
      base = ((payload[0] << 8) | payload[1]) * 0x10000;
    }
    // 0x03 / 0x05 (start address) are ignored
  }

  if (!chunks.length) throw new Error("HEX file contains no data");
  const data = new Uint8Array(max - min).fill(0xff);
  for (const c of chunks) data.set(c.bytes, c.addr - min);
  return { data, start: min };
}

export function looksLikeHex(bytes: Uint8Array) {
  return bytes.length > 0 && bytes[0] === 0x3a; // ':'
}

/** Normalise a firmware file: HEX -> binary, everything else passes through. */
export function toBinary(bytes: Uint8Array, name: string): { data: Uint8Array; start: number | null } {
  if (name.toLowerCase().endsWith(".hex") || looksLikeHex(bytes)) {
    const { data, start } = parseIntelHex(new TextDecoder().decode(bytes));
    return { data, start };
  }
  return { data: bytes, start: null };
}

/** Download a firmware file; `version` is the release tag when served by the firmware Worker. */
export async function fetchFirmware(url: string): Promise<{ bytes: Uint8Array; version: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error(`Couldn't download ${url}. Check your internet connection, or upload a file instead.`);
  }
  if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status}). Upload a file instead.`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), version: res.headers.get("X-Firmware-Version") };
}

/** Release file name from its URL, e.g. "Chords-UNO-R4-MINIMA.bin". */
export const fileNameOf = (url: string) => decodeURIComponent(url.split("/").pop()!);

let latestTag: { at: number; tag: string | null } | null = null;

/**
 * Tag of the release that `base` serves: fixed when it is pinned
 * (".../firmware/v1.0.4"), otherwise asked from the Worker's /latest route
 * (remembered for a minute). null when it can't be found out.
 */
export async function releaseVersion(base: string): Promise<string | null> {
  const pinned = base.split("/").pop()!;
  if (pinned !== "latest") return pinned;
  if (latestTag && performance.now() - latestTag.at < 60_000) return latestTag.tag;
  try {
    const res = await fetch(new URL("/latest", base).href, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const tag: string | null = res.ok ? ((await res.json()).tag ?? null) : null;
    latestTag = { at: performance.now(), tag };
    return tag;
  } catch {
    return null;
  }
}

/** Download a release file and save it in IndexedDB. */
export async function downloadFirmware(url: string) {
  const { bytes, version } = await fetchFirmware(url);
  await saveFirmware({ name: fileNameOf(url), version, size: bytes.length, savedAt: Date.now(), url }, bytes);
  return { bytes, version };
}

/**
 * Firmware to flash: the saved copy when it is already the latest release,
 * otherwise a fresh download (saved for next time). Falls back to the saved
 * copy when the download fails, e.g. offline.
 */
export async function loadFirmware(url: string, base: string, log: (msg: string) => void) {
  const name = fileNameOf(url);
  const saved = await getSavedFirmware(name);
  if (saved?.version && saved.version === (await releaseVersion(base))) {
    log(`Using saved ${name} (${saved.version})`);
    return new Uint8Array(saved.data);
  }
  try {
    log(`Downloading ${name}…`);
    const { bytes, version } = await downloadFirmware(url);
    log(`Downloaded ${name}${version ? ` (${version})` : ""} and saved it for next time`);
    return bytes;
  } catch (e) {
    if (!saved) throw e;
    log(`Download failed, using saved ${name}${saved.version ? ` (${saved.version})` : ""}`);
    return new Uint8Array(saved.data);
  }
}

export function padTo(data: Uint8Array, multiple: number, fill = 0xff) {
  const len = Math.ceil(data.length / multiple) * multiple;
  if (len === data.length) return data;
  const out = new Uint8Array(len).fill(fill);
  out.set(data);
  return out;
}

export const hex = (n: number, w = 8) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");
