import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const MANUAL_CHUNK_RULES = [
  { name: 'vendor-vue', test: /node_modules\/(vue|vue-router)\// },
  { name: 'vendor-element-plus', test: /node_modules\/(element-plus|@element-plus)\// },
  {
    name: 'vendor-icons',
    test: /node_modules\/@iconify\//
  },
  // Monaco 内部模块存在复杂的相互依赖；按 base/platform/core/contrib 细拆
  // 会在生产环境触发 chunk 初始化顺序问题，统一收敛到单个 vendor chunk 更稳妥。
  { name: 'vendor-editor', test: /node_modules\/monaco-editor\// },
  { name: 'vendor-terminal', test: /node_modules\/@xterm\// },
  { name: 'vendor-export', test: /node_modules\/xlsx\// }
]

function getManualChunk(id) {
  // The shared preload helper must not inherit Monaco's otherwise lazy chunk.
  if (id === '\0vite/preload-helper.js') return 'preload-helper'

  if (!id.includes('node_modules')) {
    return undefined
  }

  const matchedRule = MANUAL_CHUNK_RULES.find((rule) => rule.test.test(id))
  if (matchedRule) {
    return matchedRule.name
  }

  return 'vendor-misc'
}

function editorEntryBoundary() {
  return {
    name: 'editor-entry-boundary',
    generateBundle(_options, bundle) {
      const pending = Object.values(bundle)
        .filter(chunk => chunk.type === 'chunk' && (chunk.isEntry
          || Object.keys(chunk.modules).some(id => id.endsWith('/src/components/UserSpace/UserSpace.vue'))))
        .map(chunk => chunk.fileName)
      const visited = new Set()
      while (pending.length) {
        const file = pending.pop()
        if (visited.has(file)) continue
        visited.add(file)
        const chunk = bundle[file]
        if (!chunk || chunk.type !== 'chunk') continue
        if (Object.keys(chunk.modules).some(id => /node_modules\/monaco-editor\//.test(id))) {
          this.error(`Monaco must stay outside the initial static import graph of the app and the artifact library: ${file}`)
        }
        pending.push(...chunk.imports)
      }
    }
  }
}

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  plugins: [vue(), editorEntryBoundary()],
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
