<template>
  <div class="hub-container">
    <el-tabs
      v-model="activeTab"
      class="hub-tabs"
    >
      <el-tab-pane
        v-for="tab in availableTabs"
        :key="tab.name"
        :label="tab.label"
        :name="tab.name"
      >
        <Suspense>
          <component
            :is="tab.component"
            v-if="initialized[tab.name]"
            :session-id="sessionId"
          />
        </Suspense>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, inject, reactive, ref, unref, watch } from 'vue'
import { supportsCapabilityRequirements } from '@/composables/useAgentConsoleModules.js'

const props = defineProps({
  sessionId: { type: String, required: true },
  tabDefinitions: { type: Array, required: true },
  initialTab: { type: String, required: true }
})

const agentCapabilities = inject('agentCapabilities', ref([]))
const availableTabs = computed(() =>
  props.tabDefinitions.filter((tab) => supportsCapabilityRequirements(tab, unref(agentCapabilities)))
)

const activeTab = ref(props.initialTab)
const initialized = reactive({ [props.initialTab]: true })

watch(activeTab, (key) => {
  if (!initialized[key]) initialized[key] = true
})

watch(
  availableTabs,
  (tabs) => {
    if (!tabs.length) return
    if (!tabs.some((tab) => tab.name === activeTab.value)) {
      activeTab.value = tabs[0].name
    }
    if (!initialized[activeTab.value]) initialized[activeTab.value] = true
  },
  { immediate: true }
)
</script>

<style scoped>
.hub-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-container-background);
}
.hub-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.hub-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-divider-color);
  background: var(--app-container-background);
}
.hub-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 0;
}
.hub-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.hub-tabs :deep(.el-tabs__item:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: -2px;
}
</style>
