export async function normalizeToUint8(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  return new Uint8Array(input);
}
