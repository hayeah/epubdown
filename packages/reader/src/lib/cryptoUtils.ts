export async function sha256(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return new Uint8Array(hashBuffer);
}
