/** Whether the data is already UF2 blocks (otherwise a raw .bin). */
export function isUf2(data: Uint8Array) {
  if (data.length < 512) return false;
  const v = new DataView(data.buffer, data.byteOffset, 512);
  return v.getUint32(0, true) === 0x0a324655 && v.getUint32(4, true) === 0x9e5d5157;
}
