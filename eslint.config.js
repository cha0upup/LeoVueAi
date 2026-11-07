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
  },
  {
    files: ['src/components/SkillManager/SkillHealthDialog.vue',
      'src/components/SkillManager/SkillBatchResultDialog.vue',
      'src/components/SkillManager/SkillCatalogTable.vue',
      'src/components/SkillManager/SkillCatalogFilters.vue',
      'src/components/SkillManager/SkillWorkspaceOverview.vue',
      'src/components/SkillManager/SkillIssueDrawer.vue'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['@/services/**', '@/composables/**', './useSkill*', '@/utils/apiUtils.js', '@/utils/confirmUtils.js'],
        message: 'Skill views receive data via props and delegate actions via events.'
      }] }],
      'vue/no-mutating-props': 'error'
    }
  },
  {
    files: ['src/components/SkillManager/useSkillCatalog.js', 'src/components/SkillManager/useSkillWorkspace.js',
      'src/components/SkillManager/useSkillBatchActions.js', 'src/components/SkillManager/useSkillFilters.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/*.vue', 'element-plus', '@iconify/vue'],
        message: 'Skill state controllers must stay independent of rendered views.'
      }] }]
    }
  },
  {
    files: ['src/components/SkillManager/useSkillFilters.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/*.vue', 'element-plus', '@iconify/vue', '@/services/**', '@/utils/apiUtils.js',
          '@/utils/confirmUtils.js', '@/utils/messageUtils.js', '@/utils/errorHandler.js'],
        message: 'Filter models are pure projections; state and effects come from explicit inputs.'
      }] }]
    }
  },
  {
    files: ['src/components/SkillManager/SkillManager.vue'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(clearSelection|toggleRowSelection)$/]',
        message: 'Control catalog selection through row models; widget methods belong inside SkillCatalogTable.'
      }]
    }
  }
]
