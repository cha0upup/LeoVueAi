/**
 * 纯 JavaScript MD5 实现（RFC 1321）
 *
 * 替代 crypto-js（~3MB 依赖），支持：
 *   - createMd5Hasher()                    增量哈希（适合大文件流式计算）
 *
 * 算法参考：https://www.ietf.org/rfc/rfc1321.txt
 */

// ============================================================================
// 常量
// ============================================================================

// 每轮左移位数（共 4 轮 × 16 步 = 64 步）
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]

// 每步使用的正弦函数整数值
const K = new Uint32Array(64)
for (let i = 0; i < 64; i++) {
  K[i] = (Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)) | 0
}

// ============================================================================
// 内部辅助函数
// ============================================================================

function F(x, y, z) { return (x & y) | (~x & z) }
function G(x, y, z) { return (x & z) | (y & ~z) }
function H(x, y, z) { return x ^ y ^ z }
function I(x, y, z) { return y ^ (x | ~z) }

function rotl(x, n) { return (x << n) | (x >>> (32 - n)) }

// ============================================================================
// 核心 MD5 变换
// ============================================================================

function md5Transform(state, block) {
  let a = state[0], b = state[1], c = state[2], d = state[3]

  for (let i = 0; i < 64; i++) {
    let f, g
    if (i < 16) {
      f = F(b, c, d)
      g = i
    } else if (i < 32) {
      f = G(b, c, d)
      g = (5 * i + 1) % 16
    } else if (i < 48) {
      f = H(b, c, d)
      g = (3 * i + 5) % 16
    } else {
      f = I(b, c, d)
      g = (7 * i) % 16
    }
    const temp = d
    d = c
    c = b
    b = (b + rotl(a + f + K[i] + block[g], S[i])) | 0
    a = temp
  }

  state[0] = (state[0] + a) | 0
  state[1] = (state[1] + b) | 0
  state[2] = (state[2] + c) | 0
  state[3] = (state[3] + d) | 0
}

// ============================================================================
// 增量 MD5 哈希器（流式处理大文件）
// ============================================================================

/**
 * 创建增量 MD5 哈希器
 *
 * @example
 * const hasher = createMd5Hasher()
 * hasher.update(new Uint8Array([1, 2, 3]))
 * hasher.update(new Uint8Array([4, 5, 6]))
 * const result = hasher.digest() // "e10adc3949ba59abbe56e057f20f883e"
 */
export function createMd5Hasher() {
  const state = new Int32Array([0x67452301, -0x10325477, -0x67452302, 0x10325476])
  const buffer = new Uint8Array(64)
  let bufferLen = 0
  let totalLen = 0  // 总字节数（用于最终填充）

  /**
   * 追加数据
   * @param {Uint8Array|ArrayBuffer} chunk
   */
  function update(chunk) {
    let bytes
    if (chunk instanceof ArrayBuffer) {
      bytes = new Uint8Array(chunk)
    } else {
      bytes = chunk
    }
    totalLen += bytes.length
    let offset = 0

    // 如果 buffer 中有残留 + 新数据 >= 64 字节，先拼满一个块
    if (bufferLen > 0) {
      const fill = Math.min(64 - bufferLen, bytes.length)
      buffer.set(bytes.subarray(0, fill), bufferLen)
      bufferLen += fill
      offset = fill

      if (bufferLen === 64) {
        // 转换 buffer 为 Uint32Array
        const words = new Uint32Array(16)
        for (let i = 0; i < 16; i++) {
          words[i] = buffer[i * 4] | (buffer[i * 4 + 1] << 8) | (buffer[i * 4 + 2] << 16) | (buffer[i * 4 + 3] << 24)
        }
        md5Transform(state, words)
        bufferLen = 0
      }
    }

    // 处理完整的 64 字节块
    while (offset + 64 <= bytes.length) {
      const words = new Uint32Array(16)
      for (let i = 0; i < 16; i++) {
        words[i] = bytes[offset + i * 4] | (bytes[offset + i * 4 + 1] << 8) | (bytes[offset + i * 4 + 2] << 16) | (bytes[offset + i * 4 + 3] << 24)
      }
      md5Transform(state, words)
      offset += 64
    }

    // 剩余部分存入 buffer
    if (offset < bytes.length) {
      buffer.set(bytes.subarray(offset), 0)
      bufferLen = bytes.length - offset
    }
  }

  /**
   * 完成哈希计算，返回十六进制字符串
   * @returns {string} 32 位小写十六进制 MD5 字符串
   */
  function digest() {
    // 构建填充后的最终数据
    const finalLen = bufferLen
    const padded = new Uint8Array((((finalLen + 8) >> 6) + 1) * 64)
    padded.set(buffer.subarray(0, finalLen))
    padded[finalLen] = 0x80

    // 写入长度（64-bit little-endian）
    const bitLen = totalLen * 8
    // 用 DataView 安全写入 64-bit 值
    const view = new DataView(padded.buffer)
    view.setUint32(padded.length - 8, bitLen & 0xffffffff, true)
    view.setUint32(padded.length - 4, (bitLen / 0x100000000) | 0, true)

    // 处理填充后的块
    for (let i = 0; i < padded.length; i += 64) {
      const words = new Uint32Array(16)
      for (let j = 0; j < 16; j++) {
        words[j] = padded[i + j * 4] | (padded[i + j * 4 + 1] << 8) | (padded[i + j * 4 + 2] << 16) | (padded[i + j * 4 + 3] << 24)
      }
      md5Transform(state, words)
    }

    return toHex(state)
  }

  return { update, digest }
}

// ============================================================================
// 输出转换
// ============================================================================

function toHex(int32State) {
  const hex = []
  for (let i = 0; i < 4; i++) {
    const val = int32State[i] >>> 0  // 转为 unsigned
    hex.push(
      ((val >>> 0) & 0xff).toString(16).padStart(2, '0'),
      ((val >>> 8) & 0xff).toString(16).padStart(2, '0'),
      ((val >>> 16) & 0xff).toString(16).padStart(2, '0'),
      ((val >>> 24) & 0xff).toString(16).padStart(2, '0')
    )
  }
  return hex.join('')
}
