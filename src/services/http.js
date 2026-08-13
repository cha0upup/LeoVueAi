import axios from 'axios'
import { ROUTE_PATHS } from '@/constants/app.js'
import { normalizeHttpError } from './httpError.js'
import { resolveApiBaseUrl } from './apiBaseUrl.js'

const ERROR_REDIRECT_MAP = {
  401: ROUTE_PATHS.login,
  403: ROUTE_PATHS.main
}

let errorNavigation = {
  getCurrentRoute: () => null,
  replaceRoute: null,
  resetAuth: null
}

export const configureHttpErrorHandling = (handlers = {}) => {
  errorNavigation = { ...errorNavigation, ...handlers }
}

const resolveErrorRedirect = (code, payload) => {
  if (code === 403 && payload?.data?.passwordChangeRequired === true) {
    return ROUTE_PATHS.changePassword
  }
  if (code !== 401) return ERROR_REDIRECT_MAP[code]

  const currentRoute = errorNavigation.getCurrentRoute?.()
  if (!currentRoute?.fullPath || currentRoute.path === ROUTE_PATHS.login) {
    return ROUTE_PATHS.login
  }

  return {
    path: ROUTE_PATHS.login,
    query: { redirect: currentRoute.fullPath }
  }
}

const resetCachedAuth = () => {
  errorNavigation.resetAuth?.()
}

const redirectForError = (target) => {
  if (!target) return

  const targetPath = typeof target === 'string' ? target : target.path
  if (errorNavigation.getCurrentRoute?.()?.path === targetPath) return
  if (!errorNavigation.replaceRoute) return

  // 鉴权失败属于状态纠正而非用户导航，replace 避免返回键再次进入失效页面。
  Promise.resolve(errorNavigation.replaceRoute(target)).catch(() => {
    // 路由切换期间可能已有其他请求完成了相同跳转，忽略重复导航结果。
  })
}

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

http.interceptors.response.use(
  (response) => {
    const data = response.data

    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 200) {
        response.data = data.data
        return response
      }

      const error = new Error(data.msg || '请求失败')
      error.response = {
        ...response,
        data: { ...data }
      }
      error.code = data.code

      const target = resolveErrorRedirect(data.code, data)
      if (target) {
        if (data.code === 401) {
          resetCachedAuth()
        }
        redirectForError(target)
      }

      return Promise.reject(error)
    }

    return response
  },
  (error) => {
    const { code } = normalizeHttpError(error)

    const target = resolveErrorRedirect(code, error?.response?.data)
    if (target) {
      if (code === 401) {
        resetCachedAuth()
      }
      redirectForError(target)
    }
    return Promise.reject(error)
  }
)

export default http
