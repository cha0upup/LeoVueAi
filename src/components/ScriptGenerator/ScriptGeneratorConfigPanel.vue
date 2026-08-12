<template>
  <section class="config-panel">
    <header class="panel-heading">
      <strong class="panel-title">生成配置 · {{ currentModeLabel }}</strong>
    </header>

    <ScriptRuntimeSelector
      v-model:form="form"
      :runtime-generators="runtimeGenerators"
      @set-runtime="emit('set-runtime', $event)"
      @set-generate-type="emit('set-generate-type', $event)"
    />

    <div class="form-scroll">
      <el-form
        :model="form"
        label-position="top"
        class="script-form"
      >
        <DisguiseTransportPanel
          v-model:form="form"
          :disguises="disguises"
        />

        <JavaRuntimeConfig
          v-if="form.runtime === 'java'"
          v-model:form="form"
          :server-types="serverTypes"
          :available-injector-shell-types="availableInjectorShellTypes"
          :injector-capabilities="injectorCapabilities"
          :packer-types-structure="packerTypesStructure"
          :packer-types-flat="packerTypesFlat"
          :target-java-versions="targetJavaVersions"
          :packer-compatibility="packerCompatibility"
          :servlet-namespaces="servletNamespaces"
          :transport-protocols="transportProtocols"
          @server-type-change="emit('server-type-change')"
          @generate-random-header="emit('generate-random-header')"
        >
          <ObfuscationEditor
            v-if="showObfuscationSection"
            v-model="form.jspObfuscationSteps"
            :obfuscation-steps="obfuscationSteps"
            :packer-obfuscation-steps="packerObfuscationSteps"
            :packer-types-structure="packerTypesStructure"
            :generate-type="form.generateType"
            :shell-type="form.shellType"
            :packer-type="form.packerType"
          />
        </JavaRuntimeConfig>

        <PhpRuntimeConfig
          v-else
          v-model:form="form"
          :metadata="runtimeGenerators.php"
          @generate-random-header="emit('generate-random-header')"
        />
      </el-form>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import ObfuscationEditor from './ObfuscationEditor.vue'
import ScriptRuntimeSelector from './ScriptRuntimeSelector.vue'
import DisguiseTransportPanel from './DisguiseTransportPanel.vue'
import JavaRuntimeConfig from './JavaRuntimeConfig.vue'
import PhpRuntimeConfig from './PhpRuntimeConfig.vue'

const form = defineModel('form', { type: Object, required: true })

const props = defineProps({
  runtimeGenerators: {
    type: Object,
    default: () => ({})
  },
  disguises: {
    type: Array,
    default: () => []
  },
  serverTypes: {
    type: Array,
    default: () => []
  },
  availableInjectorShellTypes: {
    type: Array,
    default: () => []
  },
  injectorCapabilities: {
    type: Array,
    default: () => []
  },
  packerTypesStructure: {
    type: Object,
    required: true
  },
  packerTypesFlat: {
    type: Array,
    default: () => []
  },
  targetJavaVersions: {
    type: Array,
    default: () => ['auto', '6', '7', '8', '9+', '17+']
  },
  packerCompatibility: {
    type: Object,
    default: () => ({})
  },
  servletNamespaces: {
    type: Array,
    default: () => ['auto', 'javax', 'jakarta']
  },
  transportProtocols: {
    type: Object,
    default: () => ({
      webshell: ['http', 'httpchunk'],
      memoryshell: ['http', 'httpchunk', 'websocket']
    })
  },
  obfuscationSteps: {
    type: Array,
    default: () => []
  },
  packerObfuscationSteps: {
    type: Object,
    default: () => ({})
  },
  currentModeLabel: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['set-runtime', 'set-generate-type', 'server-type-change', 'generate-random-header'])

// ---- JSP 混淆层逻辑 ----

/** 判断当前选中 packer 是否属于 Jsp 分组 */
const isJspPackerSelected = computed(() => {
  const pt = form.value.packerType
  if (!pt) return false
  for (const group of (props.packerTypesStructure.groups || [])) {
    if (group.groupName === 'Jsp' && Array.isArray(group.packers) && group.packers.includes(pt)) {
      return true
    }
  }
  return false
})

/** 是否显示混淆层配置区：webshell JSP/JSPX 模式，或内存马选中 Jsp 分组 packer */
const showObfuscationSection = computed(() => {
  if (form.value.runtime === 'php') return false
  if (form.value.generateType === 'webshell') {
    return form.value.shellType === 'JSP' || form.value.shellType === 'JSPX'
  }
  return isJspPackerSelected.value
})
</script>

<style scoped>
.config-panel {
  min-height: 0;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: color-mix(in srgb, var(--app-card-background) 94%, var(--app-surface-background));
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--app-surface-border-subtle);
  background: var(--app-container-background);
  flex-shrink: 0;
}

.panel-title {
  color: var(--sg-ink);
  font-size: 14px;
  line-height: 1.2;
}

.form-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 10px;
}

.script-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-group {
  padding: 8px 0 10px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.form-group:first-child {
  border-top: 0;
  padding-top: 6px;
}

.script-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.script-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  color: var(--sg-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
}

.script-form :deep(.el-select),
.script-form :deep(.el-input-number) {
  width: 100%;
}

.script-form :deep(.el-input__wrapper),
.script-form :deep(.el-select__wrapper),
.script-form :deep(.el-input-number__decrease),
.script-form :deep(.el-input-number__increase) {
  min-height: 32px;
  border-radius: var(--radius-control);
  background: var(--sg-panel-strong);
  border-color: var(--sg-border);
  box-shadow: none;
}

.form-scroll::-webkit-scrollbar {
  width: 6px;
}

.form-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.form-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-border-color) 80%, transparent);
}

@media (max-width: 1220px) {
  .config-panel {
    min-height: 640px;
  }
}

@media (max-width: 760px) {
  .form-scroll {
    padding-left: 10px;
    padding-right: 10px;
  }
}
</style>
