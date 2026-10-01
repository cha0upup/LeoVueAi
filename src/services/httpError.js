export const normalizeHttpError = (error) => {
  const errorObject = error && typeof error === 'object' ? error : null
  const payload = errorObject?.response?.data
  const rawCode = payload && typeof payload === 'object' && payload.code != null
    ? payload.code
    : errorObject?.response?.status
  const numericCode = Number(rawCode)
  const code = rawCode != null && rawCode !== '' && Number.isInteger(numericCode)
    ? numericCode
    : undefined
  const payloadMessage = payload && typeof payload === 'object'
    ? payload.msg
    : ''
  const message = payloadMessage || errorObject?.message || (typeof error === 'string' ? error : '') || '请求失败'

  if (errorObject) {
    if (code !== undefined) errorObject.code = code
    errorObject.message = message
  }
  return { code, message }
}

export function createHttpError(response, fallbackMessage = '请求失败') {
  const error = new Error(fallbackMessage)
  error.response = response
  normalizeHttpError(error)
  return error
}
