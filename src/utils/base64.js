/** 字节编解码保持原始内容；URL-safe 等输入规范化由调用方决定。 */
export function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

export function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}
