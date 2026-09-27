<template>
  <el-dialog
    :model-value="visible"
    :title="isEditing ? '编辑数据库配置' : '新增数据库连接'"
    width="min(860px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    destroy-on-close
    class="config-dialog database-connection-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      label-width="96px"
      :rules="formRules"
      class="connection-config-form"
    >
      <section class="connection-panel">
        <div class="connection-panel__heading">
          <span class="connection-panel__index">1</span>
          <div>
            <strong>选择数据库类型</strong>
            <span>决定平台能否自动识别数据库结构和生成 SQL。</span>
          </div>
        </div>

        <el-radio-group
          v-model="databaseKind"
          class="connection-kind-grid"
          @change="onDatabaseKindChange"
        >
          <el-radio
            value="builtin"
            border
            class="connection-kind-card"
          >
            <span class="connection-kind-card__title">预置数据库</span>
            <span class="connection-kind-card__description">使用平台内置方言，支持结构浏览和结构化操作。</span>
          </el-radio>
          <el-radio
            value="generic"
            border
            class="connection-kind-card"
          >
            <span class="connection-kind-card__title">通用 SQL</span>
            <span class="connection-kind-card__description">适用于冷门数据库、代理数据库或自定义 JDBC 驱动。</span>
          </el-radio>
        </el-radio-group>

        <div
          v-if="databaseKind === 'builtin'"
          class="connection-panel__field"
        >
          <el-form-item
            label="数据库方言"
            prop="dialect"
            required
          >
            <el-select
              v-model="form.dialect"
              placeholder="选择平台支持的数据库"
              style="width: 100%"
              :loading="dialectCatalogLoading"
              :disabled="dialectCatalogLoading || Boolean(dialectCatalogError)"
              @change="onDialectChange"
            >
              <el-option-group
                v-for="group in dialectGroups.filter((item) => item.value !== 'generic')"
                :key="group.value"
                :label="group.label"
              >
                <el-option
                  v-for="tpl in group.options"
                  :key="tpl.value"
                  :label="tpl.name"
                  :value="tpl.value"
                />
              </el-option-group>
            </el-select>
            <div
              v-if="dialectCatalogError"
              class="form-tip error"
            >
              {{ dialectCatalogError }}
            </div>
          </el-form-item>
          <el-form-item
            v-if="variants.length > 1"
            label="连接变体"
            prop="variant"
          >
            <el-radio-group
              v-model="form.variant"
              class="connection-variant-options"
              @change="onVariantChange"
            >
              <el-radio-button
                v-for="variant in variants"
                :key="variant.key"
                :value="variant.key"
              >
                {{ variant.name }}
              </el-radio-button>
            </el-radio-group>
            <div class="form-tip">
              选择数据库实例的地址格式，字段会随变体自动切换。
            </div>
          </el-form-item>
        </div>
        <div
          v-else
          class="generic-kind-summary"
        >
          <div>
            <strong>通用 SQL 连接</strong>
            <span>使用原生 SQL 工作，不依赖平台内置数据库映射。</span>
          </div>
          <el-tag
            type="warning"
            effect="plain"
          >
            仅原生 SQL
          </el-tag>
        </div>
      </section>

      <section
        v-if="form.dialect"
        class="connection-panel"
      >
        <div class="connection-panel__heading">
          <span class="connection-panel__index">2</span>
          <div>
            <strong>配置连接</strong>
            <span>填写当前 Puppet 能够访问的数据库地址和驱动信息。</span>
          </div>
        </div>

        <div
          v-if="connectionModeOptions.length > 1"
          class="connection-mode-switch"
        >
          <div class="connection-mode-switch__label">
            连接方式
          </div>
          <el-radio-group
            v-model="form.connectionMode"
            @change="onConnectionModeChange"
          >
            <el-radio-button
              v-for="option in connectionModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
          <span class="form-tip">标准配置自动生成 URL；自定义运行时使用已安装的 JDBC/PDO 驱动。</span>
        </div>

        <div class="connection-target-card">
          <template v-if="form.connectionMode === 'standard' && form.dialect === 'sqlite'">
            <el-form-item
              label="文件路径"
              prop="file"
              required
            >
              <el-input
                v-model="form.file"
                placeholder="/path/to/database.sqlite"
                clearable
              />
            </el-form-item>
          </template>
          <template v-else-if="form.connectionMode === 'standard'">
            <div class="config-form-grid">
              <el-form-item
                label="主机"
                prop="host"
                required
              >
                <el-input
                  v-model="form.host"
                  placeholder="localhost"
                  clearable
                />
              </el-form-item>
              <el-form-item
                label="端口"
                prop="port"
                required
              >
                <el-input-number
                  v-model="form.port"
                  :min="1"
                  :max="65535"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </div>
            <div class="config-form-grid">
              <el-form-item
                v-if="visibleFields.has('database')"
                label="数据库"
              >
                <el-input
                  v-model="form.database"
                  placeholder="数据库名称"
                  clearable
                />
              </el-form-item>
              <el-form-item
                v-if="visibleFields.has('service')"
                label="Service"
                required
              >
                <el-input
                  v-model="form.service"
                  placeholder="ORCLPDB1"
                  clearable
                />
              </el-form-item>
              <el-form-item
                v-if="visibleFields.has('sid')"
                label="SID"
                required
              >
                <el-input
                  v-model="form.sid"
                  placeholder="ORCL"
                  clearable
                />
              </el-form-item>
            </div>
          </template>

          <div class="config-form-grid">
            <el-form-item label="用户名">
              <el-input
                v-model="form.username"
                placeholder="数据库用户名"
                clearable
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="form.password"
                type="password"
                :placeholder="isEditing ? '留空则保留原密码' : '数据库密码'"
                show-password
                clearable
              />
            </el-form-item>
          </div>

          <DatabaseRuntimeOverrides
            v-if="form.connectionMode === 'custom'"
            v-model="form.runtimeOptions"
            :capabilities="runtimeCapabilities"
            :loading="runtimeCapabilitiesLoading"
            :default-open="true"
            @refresh="inspectRuntimeCapabilities"
          />

          <el-form-item
            v-if="form.dialect === 'generic'"
            label="连通性 SQL"
            required
          >
            <el-input
              v-model="form.testSql"
              type="textarea"
              :rows="2"
              placeholder="例如 SELECT 1、VALUES 1 或厂商专用健康检查 SQL"
            />
            <div class="form-tip">
              用于保存前验证数据库是否可执行 SQL；不同数据库的语法可能不同。
            </div>
          </el-form-item>
        </div>

        <el-collapse
          v-model="advancedOpen"
          class="connection-advanced-options"
        >
          <el-collapse-item name="advanced">
            <template #title>
              <span>高级连接选项</span>
              <span class="connection-advanced-options__hint">超时、连接属性</span>
            </template>
            <div class="config-form-grid">
              <el-form-item label="连接超时">
                <el-input-number
                  v-model="form.timeoutSeconds"
                  :min="1"
                  :max="300"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
              <div class="connection-advanced-options__note">
                范围 1–300 秒，默认 30 秒。
              </div>
            </div>
            <el-form-item label="连接属性">
              <el-input
                v-model="form.optionsText"
                type="textarea"
                :rows="3"
                placeholder="JSON 对象，例如 {&quot;charset&quot;:&quot;utf8mb4&quot;}"
              />
            </el-form-item>
            <DatabaseRuntimeOverrides
              v-if="form.connectionMode === 'standard'"
              v-model="form.runtimeOptions"
              :capabilities="runtimeCapabilities"
              :loading="runtimeCapabilitiesLoading"
              :default-open="hasRuntimeOverrides"
              @refresh="inspectRuntimeCapabilities"
            />
          </el-collapse-item>
        </el-collapse>

        <DatabaseConnectionDiagnostics :result="connectionTestResult" />
      </section>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          :disabled="testing || saving"
          @click="handleCancel"
        >
          取消
        </el-button>
        <el-button
          :loading="testing"
          :disabled="!isComplete || saving"
          @click="handleTestConnection"
        >
          先测试连接
        </el-button>
        <el-button
          type="primary"
          :loading="saving || testing"
          :disabled="!isComplete"
          @click="handleSaveConnection"
        >
          {{ submitLabel }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, reactive, watch } from 'vue'
import { ElNotification } from 'element-plus'
import { executeRequest } from '@/utils/apiUtils.js'
import { validateForm, handleFormSubmit } from '@/utils/formUtils.js'
import {
  buildDatabaseConnection,
  createDatabaseConfigForm,
  createEditingDatabaseConfigForm,
  databaseConfigFormRules,
  resetDatabaseConfigForm,
  useDatabaseConfigDialogBase,
  verifySavedDatabaseConnection
} from './database-config-dialog-shared.js'
import { saveDatabaseConnectionApi } from '@/services/api.js'
import { showWarning } from '@/utils/messageUtils.js'
import DatabaseConnectionDiagnostics from './DatabaseConnectionDiagnostics.vue'
import DatabaseRuntimeOverrides from './DatabaseRuntimeOverrides.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sessionId: { type: String, required: true },
  mode: { type: String, default: 'create', validator: (value) => ['create', 'edit'].includes(value) },
  editingConfig: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'success', 'cancel'])

const isEditing = computed(() => props.mode === 'edit')
const templates = ref([])
const saving = ref(false)
const testing = ref(false)
const databaseKind = ref('builtin')
const advancedOpen = ref([])
const form = reactive(createDatabaseConfigForm())
const hasRuntimeOverrides = computed(
  () => Object.keys(buildDatabaseConnection(form).runtimeOptions).length > 0
)
const keepsSavedPassword = computed(
  () => isEditing.value && Boolean(props.editingConfig?.connectionId) && !form.password
)
const submitLabel = computed(() => {
  if (testing.value) return '测试中...'
  if (saving.value) return '保存中...'
  return keepsSavedPassword.value ? '保存并测试' : '测试并保存'
})
const formRules = databaseConfigFormRules
const formRef = ref(null)
const {
  visibleFields,
  variants,
  dialectGroups,
  connectionModeOptions,
  isComplete,
  runtimeCapabilities,
  runtimeCapabilitiesLoading,
  dialectCatalogLoading,
  dialectCatalogError,
  connectionTestResult,
  loadDatabaseTemplates,
  syncDialectSelection,
  inspectRuntimeCapabilities,
  resetRuntimeState,
  testConnectionOnly
} = useDatabaseConfigDialogBase({
  form,
  templates,
  sessionId: props.sessionId
})

const loadEditingConfig = () => {
  const config = props.editingConfig
  if (!config) return

  Object.assign(form, createEditingDatabaseConfigForm(config))
  databaseKind.value = form.dialect === 'generic' ? 'generic' : 'builtin'
  advancedOpen.value = form.timeoutSeconds !== 30 || form.optionsText !== '{}' || hasRuntimeOverrides.value
    ? ['advanced']
    : []
  formRef.value?.clearValidate?.()
}

const refreshRuntime = (fields = []) => {
  if (fields.length) formRef.value?.clearValidate?.(fields)
  connectionTestResult.value = null
  return form.dialect ? inspectRuntimeCapabilities() : undefined
}

const onDatabaseKindChange = (kind) => {
  if (kind === 'generic') {
    form.dialect = 'generic'
    syncDialectSelection()
  } else {
    if (form.dialect === 'generic') form.dialect = ''
    form.connectionMode = 'standard'
  }
  refreshRuntime()
}

const onDialectChange = () => {
  databaseKind.value = 'builtin'
  syncDialectSelection()
  refreshRuntime(['dialect', 'variant'])
}

const onVariantChange = refreshRuntime
const onConnectionModeChange = refreshRuntime

const runConnectionTest = async () => {
  const result = await testConnectionOnly()
  if (result.success) {
    ElNotification({ title: '测试连接成功', message: '数据库连通性校验通过', type: 'success' })
    return true
  }

  ElNotification({
    title: '测试连接失败',
    message: result.message || '请检查连接配置',
    type: 'error'
  })
  return false
}

const executeConnectionTest = (save = false) =>
  executeRequest(
    async () => {
      const result = await runConnectionTest()
      if (!result) {
        throw new Error(save ? '连接测试失败，请检查配置后重试' : '连接测试失败')
      }
      return result
    },
    {
      loadingRef: testing,
      successMessage: null, // testConnectionOnly内部已经使用了ElNotification
      errorMessage: save ? '连接测试失败，请检查配置后重试' : null
    }
  )

const handleTestConnection = async () => {
  if (!isComplete.value) {
    showWarning('请填写完整的连接信息')
    return
  }
  await executeConnectionTest()
}

const doSaveConnection = async () => {
  await handleFormSubmit(
    async () => {
      const requestData = {
        sessionId: props.sessionId,
        connection: buildDatabaseConnection(form, { omitEmptyPassword: isEditing.value })
      }

      if (isEditing.value && props.editingConfig?.connectionId) {
        requestData.connectionId = props.editingConfig.connectionId
        requestData.connectionName = props.editingConfig.connectionName
      }

      const response = await saveDatabaseConnectionApi(requestData)
      try {
        await verifySavedDatabaseConnection({ sessionId: props.sessionId, response })
      } catch {
        ElNotification({
          title: isEditing.value ? '连接已更新' : '连接已保存',
          message: '保存后的连通性复检失败，状态已记录',
          type: 'warning'
        })
      }
      return response
    },
    {
      loadingRef: saving,
      successMessage: isEditing.value ? '数据库连接更新成功' : '数据库连接保存成功',
      errorMessage: '保存失败',
      onSuccess: () => {
        handleCancel()
        emit('success')
      }
    }
  )
}

const handleSaveConnection = async () => {
  // 验证表单
  const isValid = await validateForm(formRef, {
    errorMessage: '请填写完整的连接信息'
  })
  if (!isValid) return

  if (!isComplete.value) {
    // ElMessage已经在validateForm中显示
    return
  }

  // 编辑时空密码沿用服务端凭据，保存后通过连接 ID 复检。
  if (keepsSavedPassword.value) {
    await doSaveConnection()
    return
  }

  await executeConnectionTest(true)
    .then(async () => {
      // 测试成功后保存
      await doSaveConnection()
    })
    .catch(() => {
      // 测试失败，不执行保存
    })
}

const resetDialog = () => {
  resetRuntimeState()
  resetDatabaseConfigForm(form, formRef)
  databaseKind.value = 'builtin'
  advancedOpen.value = []
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
  resetDialog()
}

watch(
  () => props.visible,
  async (visible, _previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    resetDialog()
    if (!visible) return

    await loadDatabaseTemplates()
    if (cancelled) return
    if (isEditing.value) {
      loadEditingConfig()
      if (form.dialect) inspectRuntimeCapabilities()
    }
  },
  { immediate: true }
)

watch(
  () => props.editingConfig,
  (config) => {
    if (isEditing.value && config && props.visible && !dialectCatalogLoading.value) {
      resetRuntimeState()
      loadEditingConfig()
      inspectRuntimeCapabilities()
    }
  },
  { deep: true }
)
</script>

<style scoped>
@import '@/styles/database-config-dialog-shared.css';

.connection-panel {
  margin-bottom: 14px;
  padding: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.connection-panel__heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.connection-panel__heading > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.connection-panel__heading strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.connection-panel__heading span:not(.connection-panel__index) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.connection-panel__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 12px;
  font-weight: 700;
}

.connection-kind-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  margin-bottom: 16px;
}

.connection-kind-card {
  display: flex;
  align-items: flex-start;
  min-height: 84px;
  margin: 0 !important;
  padding: 14px !important;
  border-radius: 8px;
  white-space: normal;
}

.connection-kind-card :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  white-space: normal;
}

.connection-kind-card__title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 650;
}

.connection-kind-card__description {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.connection-panel__field {
  max-width: 680px;
}

.connection-variant-options {
  display: flex;
  flex-wrap: wrap;
}

.generic-kind-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 2px;
  padding: 12px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
}

.generic-kind-summary > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.generic-kind-summary strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.generic-kind-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.connection-mode-switch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--database-config-muted-surface);
}

.connection-mode-switch__label {
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
}

.connection-mode-switch .form-tip {
  flex: 1 1 100%;
  margin: 0;
}

.connection-target-card {
  padding: 14px 14px 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.connection-advanced-options {
  margin-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.connection-advanced-options__hint {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}

.connection-advanced-options__note {
  align-self: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .connection-kind-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .generic-kind-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .connection-mode-switch {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
