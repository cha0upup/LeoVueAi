export function isScriptGeneratorFormValid(form) {
  if (!form?.reqDisguiseId || !form?.respDisguiseId) return false

  if (form.runtime === 'php') {
    const headerName = form.headerName?.trim() || ''
    const headerValue = String(form.headerValue ?? '').trim()
    const outputMode = form.phpOutputMode || 'compact'
    return Boolean(
      form.respCode &&
      ['compact', 'packed', 'portable'].includes(outputMode) &&
      Boolean(headerName) === Boolean(headerValue)
    )
  }

  if (form.generateType === 'webshell') {
    const requiresProtocol = form.shellType === 'JSP' || form.shellType === 'JSPX'
    return Boolean(
      form.shellType &&
        form.respCode &&
        (!requiresProtocol || form.protocol)
    )
  }

  if (form.generateType === 'memoryshell') {
    const protocol = String(form.protocol || 'http').toLowerCase()
    const validWebSocketPath = protocol !== 'websocket' || (
      form.urlPattern?.startsWith('/') && !form.urlPattern.includes('*')
    )
    const validHeaderGuard = protocol === 'websocket' || (
      form.headerName?.trim() && String(form.headerValue ?? '').trim() !== ''
    )
    return Boolean(
      form.serverType &&
        form.shellType &&
        form.packerType &&
        validHeaderGuard &&
        validWebSocketPath &&
        form.respCode
    )
  }

  return false
}
