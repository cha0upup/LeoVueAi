import { createApp } from 'vue'
import { Icon } from '@iconify/vue'

import App from './App.vue'
import router from '@/router.js'
import { setupMonacoEnvironment } from '@/utils/monacoEnvironment.js'
import { setupElementPlus } from '@/plugins/element-plus.js'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './assets/global.css'
import '@/styles/design-tokens.css'
import '@/styles/element-plus-overrides.css'
import { showError } from '@/utils/messageUtils.js'
import { createLogger } from '@/utils/logger.js'

const logger = createLogger('Vue')

setupMonacoEnvironment()

const app = createApp(App)

// 全局注册Iconify图标组件
app.component('Icon', Icon)

app.use(router)

// Element Plus 按需引入（仅注册 ~50 个实际使用的组件，替代全量 import）
setupElementPlus(app)

/**
 * Vue 全局错误处理器。
 *
 * 把真实的错误信息输出到控制台，方便定位问题。
 * 使用防抖避免高频渲染错误导致 ElMessage 刷屏。
 */
let _errorToastTimer = null
app.config.errorHandler = (err, instance, info) => {
  // 始终把完整错误输出到控制台
  logger.error(info || '未捕获的渲染错误', err)

  // 防抖：500ms 内只弹一次提示
  if (!_errorToastTimer) {
    const message = err?.message
      ? `发生意外错误：${err.message.length > 120 ? err.message.slice(0, 120) + '…' : err.message}`
      : '发生意外错误，请刷新重试'
    showError(message)
    _errorToastTimer = setTimeout(() => {
      _errorToastTimer = null
    }, 500)
  }
}

app.mount('#app')
