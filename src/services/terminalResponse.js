/** Component responses share one boundary across reads, batches and write attachments. */
export function requireTerminalSuccess(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof payload.code !== 'number'
  ) {
    throw new Error('终端响应格式无效，请同步更新服务器和节点组件')
  }
  if (payload.code !== 200) {
    throw new Error(payload.msg || `终端请求失败 (${payload.code})`)
  }
  return payload
}
