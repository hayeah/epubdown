/**
 * Convert Uint8Array to base64 string safely without using spread operator
 * This avoids "Maximum call stack size exceeded" errors for large arrays
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const chunkSize = 8192; // Process 8KB at a time
  let result = "";

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(result);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
