const isDevelopment = import.meta.env.DEV

const write = (level, scope, args) => {
  if (level !== 'error' && !isDevelopment) return
  const prefix = scope ? `[${scope}]` : '[LeoAI]'
  // Console access is intentionally centralized so production filtering and
  // future remote reporting can be changed without touching feature code.
  // eslint-disable-next-line no-console
  console[level](prefix, ...args)
}

export const createLogger = (scope) => ({
  debug: (...args) => write('debug', scope, args),
  info: (...args) => write('info', scope, args),
  warn: (...args) => write('warn', scope, args),
  error: (...args) => write('error', scope, args)
})
