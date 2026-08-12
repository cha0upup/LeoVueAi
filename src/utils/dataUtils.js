/**
 * 数据工具函数
 * 提供数据转换、构建和处理的通用方法
 */
/**
 * 从对象中排除指定字段
 * @param {Object} obj - 源对象
 * @param {Array<string>} fields - 要排除的字段列表
 * @returns {Object} 排除指定字段后的新对象
 */
export function omitFields(obj, fields) {
  const result = { ...obj }
  fields.forEach((field) => {
    delete result[field]
  })
  return result
}

/**
 * 验证IP地址格式
 * @param {string} ip - IP地址
 * @returns {boolean} 是否为有效IP地址
 */
export function isValidIP(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255
  })
}

/**
 * IP地址转数字
 * @param {string} ip - IP地址
 * @returns {number} IP地址的数值表示
 */
function ipToNumber(ip) {
  const parts = ip.split('.')
  return (
    (parseInt(parts[0]) << 24) +
    (parseInt(parts[1]) << 16) +
    (parseInt(parts[2]) << 8) +
    parseInt(parts[3])
  )
}

/**
 * 数字转IP地址
 * @param {number} num - IP地址的数值表示
 * @returns {string} IP地址字符串
 */
function numberToIP(num) {
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.')
}

/**
 * 解析CIDR格式并返回所有IP地址
 * @param {string} cidr - CIDR格式，如 "192.168.1.0/24"
 * @returns {Array<string>} IP地址列表
 */
export function parseCIDR(cidr) {
  const cidrPattern = /^((\d{1,3}\.){3}\d{1,3})\/(\d{1,2})$/
  const match = cidr.match(cidrPattern)

  if (!match) {
    throw new Error('无效的CIDR格式')
  }

  const ip = match[1]
  const prefixLength = parseInt(match[3], 10)

  if (!isValidIP(ip)) {
    throw new Error('无效的IP地址')
  }

  if (prefixLength < 0 || prefixLength > 32) {
    throw new Error('子网掩码长度必须在0-32之间')
  }

  // 限制最大解析数量，避免生成过多IP
  const maxIPs = 1024 // 最多生成1024个IP
  const totalIPs = Math.pow(2, 32 - prefixLength)

  if (totalIPs > maxIPs) {
    throw new Error(`CIDR范围过大，最多支持${maxIPs}个IP地址（当前为${totalIPs}个）`)
  }

  const ipNum = ipToNumber(ip)
  const mask = (0xffffffff << (32 - prefixLength)) >>> 0
  const networkNum = (ipNum & mask) >>> 0
  const broadcastNum = (networkNum | (~mask >>> 0)) >>> 0

  const ips = []

  // 特殊处理边界情况
  if (prefixLength === 32) {
    // /32 表示单个IP地址
    ips.push(ip)
  } else if (prefixLength === 31) {
    // /31 用于点对点链路，两个IP都是有效主机地址
    ips.push(numberToIP(networkNum))
    ips.push(numberToIP(broadcastNum))
  } else {
    // /30 及以下，排除网络地址和广播地址
    for (let i = networkNum + 1; i < broadcastNum; i++) {
      ips.push(numberToIP(i))
    }
  }

  return ips
}

/**
 * 判断字符串是否为CIDR格式
 * @param {string} str - 待判断的字符串
 * @returns {boolean} 是否为CIDR格式
 */
export function isCIDR(str) {
  const cidrPattern = /^((\d{1,3}\.){3}\d{1,3})\/(\d{1,2})$/
  return cidrPattern.test(str)
}
