const PAYLOAD_KEY_LENGTH = 8
const PAYLOAD_KEY_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const RANDOM_BYTE_LIMIT = 256 - (256 % PAYLOAD_KEY_ALPHABET.length)

/** Generate a short PayloadCodec input backed by the browser CSPRNG. */
export function generatePayloadKey() {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('当前环境不支持安全随机数生成')
  }

  let result = ''
  const bytes = new Uint8Array(PAYLOAD_KEY_LENGTH)
  while (result.length < PAYLOAD_KEY_LENGTH) {
    cryptoApi.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= RANDOM_BYTE_LIMIT) continue
      result += PAYLOAD_KEY_ALPHABET[byte % PAYLOAD_KEY_ALPHABET.length]
      if (result.length === PAYLOAD_KEY_LENGTH) break
    }
  }
  return result
}
