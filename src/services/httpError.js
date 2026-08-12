export const normalizeHttpError = (error) => {
  const errorObject = error && typeof error === 'object' ? error : null
  const payload = errorObject?.response?.data
  const rawCode = payload && typeof payload === 'object'
    ? payload.code
    : errorObject?.response?.status
  const numericCode = Number(rawCode)
  const code = Number.isInteger(numericCode) ? numericCode : undefined
  const payloadMessage = payload && typeof payload === 'object'
    ? payload.msg
    : ''
  const message = payloadMessage || errorObject?.message || (typeof error === 'string' ? error : '') || '请求失败'

  if (errorObject) {
    errorObject.code = code
    errorObject.message = message
  }
  return { code, message }
}
