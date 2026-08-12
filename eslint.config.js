import pluginVue from 'eslint-plugin-vue'
import js from '@eslint/js'

export default [
  // 全局忽略
  { ignores: ['dist/', 'node_modules/', 'public/', '.claude/', 'vite.config.*.mjs'] },

  // 基础 JS 推荐规则
  js.configs.recommended,

  // Vue 3 推荐规则
  ...pluginVue.configs['flat/recommended'],

  // 自定义规则
  {
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        atob: 'readonly',
        Blob: 'readonly',
        btoa: 'readonly',
        cancelAnimationFrame: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        EventSource: 'readonly',
        fetch: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        requestAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'warn'
    }
  }
]
