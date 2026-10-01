import axios from 'axios'
import { createHttpError } from './httpError.js'
import { handleHttpError } from './httpErrorHandling.js'
import { resolveApiBaseUrl } from './apiBaseUrl.js'
import { createSessionChangedError, isCurrentSession, sessionGeneration } from './sessionLifecycle.js'

export { configureHttpErrorHandling } from './httpErrorHandling.js'

// 生产部署使用同源 API；开发环境可通过 VITE_API_PORT 分离前后端端口。
const BASE_URL = resolveApiBaseUrl(window.location, import.meta.env.VITE_API_PORT)

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8'
  },
  withCredentials: true,
  responseEncoding: 'utf8'
})

http.interceptors.request.use(
  config => {
    config.sessionGeneration = sessionGeneration.value
    return config
  },
  undefined,
  { synchronous: true }
)

http.interceptors.response.use(
  (response) => {
    if (response.config?.sessionGeneration != null && !isCurrentSession(response.config.sessionGeneration)) {
      return Promise.reject(createSessionChangedError())
    }
    const data = response.data

    if (data && typeof data === 'object' && 'code' in data) {
      if (Number(data.code) === 200) {
        response.data = data.data
        return response
      }

      return Promise.reject(handleHttpError(createHttpError(response), response.config?.sessionGeneration))
    }

    return response
  },
  (error) => {
    return Promise.reject(handleHttpError(error, error?.config?.sessionGeneration ?? error?.response?.config?.sessionGeneration))
  }
)

export default http
