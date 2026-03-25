/**
 * Convert Uint8Array to base64 string safely without stack overflow for large arrays
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const chunkSize = 8192;
  let result = "";
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}
