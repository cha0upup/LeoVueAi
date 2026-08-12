import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const MANUAL_CHUNK_RULES = [
  { name: 'vendor-vue', test: /node_modules\/(vue|vue-router)\// },
  { name: 'vendor-element-plus', test: /node_modules\/(element-plus|@element-plus)\// },
  {
    name: 'vendor-icons',
    test: /node_modules\/(@iconify|@iconify-icons|@element-plus\/icons-vue)\//
  },
  // Monaco 内部模块存在复杂的相互依赖；按 base/platform/core/contrib 细拆
  // 会在生产环境触发 chunk 初始化顺序问题，统一收敛到单个 vendor chunk 更稳妥。
  { name: 'vendor-editor', test: /node_modules\/monaco-editor\// },
  { name: 'vendor-terminal', test: /node_modules\/@xterm\// },
  { name: 'vendor-charts', test: /node_modules\/(echarts|vue-echarts)\// },
  { name: 'vendor-export', test: /node_modules\/xlsx\// }
]

function getManualChunk(id) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const matchedRule = MANUAL_CHUNK_RULES.find((rule) => rule.test.test(id))
  if (matchedRule) {
    return matchedRule.name
  }

  return 'vendor-misc'
}

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  plugins: [vue()],
  build: {
    // Monaco/editor 与导出能力是明确的大型工作台依赖，当前分包已按稳定边界收敛。
    // 保留真实异常空间，避免每次构建都被已知的大型 vendor chunk 噪声淹没。
    chunkSizeWarningLimit: 4200,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
