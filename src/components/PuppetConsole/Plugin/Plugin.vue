<template>
  <div class="plugin-page">
    <div class="plugin-panel">
      <div class="plugin-toolbar">
        <el-tabs
          v-model="activeTab"
          class="mode-tabs"
        >
          <el-tab-pane
            v-if="isPluginTabAvailable('script')"
            label="脚本执行"
            name="script"
          />
          <el-tab-pane
            v-if="isPluginTabAvailable('library')"
            :label="`插件库${pluginCount ? ` (${pluginCount})` : ''}`"
            name="library"
          />
        </el-tabs>
        <div class="toolbar-actions">
          <el-button
            v-if="activeTab === 'library'"
            type="primary"
            size="small"
            :loading="isRefreshing"
            @click="refreshPluginList"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div class="plugin-content">
        <!-- 用 v-show 而非 v-if 保留组件状态：切到插件库再切回不丢脚本草稿 -->
        <div
          v-if="isPluginTabAvailable('script')"
          v-show="activeTab === 'script'"
          class="tab-pane"
        >
          <ScriptEditor
            ref="scriptEditorRef"
            :session-id="sessionId"
            @plugin-saved="handlePluginSaved"
          />
        </div>
        <div
          v-if="isPluginTabAvailable('library')"
          v-show="activeTab === 'library'"
          class="tab-pane"
        >
          <JavaPlugin
            ref="javaPluginRef"
            :session-id="sessionId"
            @plugin-count-updated="handlePluginCountUpdated"
            @load-script="handleLoadScript"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, unref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import JavaPlugin from '@/components/PuppetConsole/Plugin/JavaPlugin.vue'
import ScriptEditor from '@/components/PuppetConsole/Plugin/ScriptEditor.vue'
import { supportsCapabilityRequirements } from '@/composables/usePuppetConsoleModules.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const iconMap = icons
const puppetCapabilities = inject('puppetCapabilities', ref([]))

defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const activeTab = ref('script')
const isRefreshing = ref(false)
const pluginCount = ref(0)

const javaPluginRef = ref(null)
const scriptEditorRef = ref(null)

const pluginTabDefinitions = [
  { name: 'script', requiredAnyCapabilities: ['script', 'componentInvoke'] },
  { name: 'library', requiredAnyCapabilities: ['plugin', 'javaPlugin'] }
]

const availablePluginTabs = computed(() =>
  pluginTabDefinitions.filter((tab) => supportsCapabilityRequirements(tab, unref(puppetCapabilities)))
)

const isPluginTabAvailable = (name) => availablePluginTabs.value.some((tab) => tab.name === name)

watch(
  availablePluginTabs,
  (tabs) => {
    if (!tabs.length) return
    if (!tabs.some((tab) => tab.name === activeTab.value)) {
      activeTab.value = tabs[0].name
    }
  },
  { immediate: true }
)

const refreshPluginList = async () => {
  isRefreshing.value = true
  try {
    if (javaPluginRef.value) {
      await javaPluginRef.value.getPlugins()
    }
    showSuccess('插件列表刷新成功')
  } catch {
    showError('刷新插件列表失败')
  } finally {
    isRefreshing.value = false
  }
}

const handlePluginCountUpdated = (count) => {
  pluginCount.value = count || 0
}

// 脚本插件保存成功后：刷新插件库列表，但不强制切 tab，保留用户当前编辑流
const handlePluginSaved = async () => {
  if (javaPluginRef.value) {
    try {
      await javaPluginRef.value.getPlugins()
    } catch {
      // 列表刷新失败不影响保存成功的反馈
    }
  }
}

// 从插件库点击「载入编辑器」：切到脚本 tab 并把脚本内容回填到编辑器
const handleLoadScript = (plugin) => {
  if (!plugin) return
  activeTab.value = 'script'
  // 等 v-show 生效（实际无需等待，因为组件一直挂载，scriptEditorRef 始终存在）
  if (scriptEditorRef.value) {
    // 注意：plugin 对象当前不带脚本明文，需要后续从后端拉。
    // 这里先把基础元信息 + 占位文本传过去，由 ScriptEditor 的 loadPlugin 处理
    scriptEditorRef.value.loadPlugin({
      ...plugin,
      // 暂未实现「拉脚本明文」端点，提示用户后续可扩展
      scriptText: plugin.scriptText || '// 该插件的脚本明文未在前端缓存。\n// 后续可扩展 /platform/plugin-manage/decompile 返回 scriptText。\n'
    })
  }
}
</script>

<style scoped>
.plugin-page {
  height: 100%;
  min-height: 0;
  padding: 0;
  background: var(--app-frame-background);
  --plugin-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --plugin-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --plugin-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
}

:global(html:not(.dark) .plugin-page),
:global(html[data-theme='light'] .plugin-page) {
  --plugin-panel-surface: var(--app-surface-background);
  --plugin-muted-surface: #f2f2f2;
  --plugin-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
}

:global(html.dark .plugin-page),
:global(html[data-theme='dark'] .plugin-page) {
  --plugin-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 86%,
    var(--el-bg-color-overlay)
  );
  --plugin-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --plugin-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.plugin-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background: var(--plugin-panel-surface);
}

.plugin-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--el-spacing-base);
  padding: 8px 16px 0;
  background: var(--plugin-muted-surface);
  border-bottom: 1px solid var(--plugin-soft-border);
}

.mode-tabs {
  flex: 1;
  min-width: 0;
}

.mode-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.mode-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.mode-tabs :deep(.el-tabs__item) {
  font-weight: 600;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
}

.plugin-content {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.tab-pane {
  height: 100%;
}

:deep(.el-button) {
  border-radius: var(--radius-control);
  font-weight: 600;
}

:deep(.el-button--primary) {
  border: none;
  box-shadow: none;
}

:deep(.el-button--primary:hover) {
  transform: none;
}

@media (max-width: 768px) {
  .plugin-page {
    padding: 0;
    background: transparent;
  }

  .plugin-panel {
    border-radius: 0;
  }

  .plugin-toolbar {
    padding: 8px 12px 0;
  }

  .plugin-content {
    padding: 12px;
  }
}
</style>
