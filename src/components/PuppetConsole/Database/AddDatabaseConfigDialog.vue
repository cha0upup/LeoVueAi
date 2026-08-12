<template>
  <el-dialog
    :model-value="visible"
    title="新增数据库配置"
    width="min(680px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    destroy-on-close
    class="config-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      label-width="104px"
      :rules="formRules"
    >
      <div class="form-section">
        <div class="section-title">
          <el-icon><Icon :icon="iconMap.database" /></el-icon>
          <span>SQL 方言</span>
        </div>
        <el-form-item
          label="SQL 方言"
          prop="dialect"
          required
        >
          <el-select
            v-model="form.dialect"
            placeholder="请选择 SQL 方言"
            style="width: 100%"
            :loading="dialectCatalogLoading"
            :disabled="dialectCatalogLoading || Boolean(dialectCatalogError)"
            @change="onDialectChange"
          >
            <el-option
              v-for="tpl in templates"
              :key="tpl.value"
              :label="tpl.name"
              :value="tpl.value"
            />
          </el-select>
          <div
            v-if="dialectCatalogError"
            class="form-tip error"
          >
            {{ dialectCatalogError }}
          </div>
        </el-form-item>
        <el-form-item label="连接模式">
          <el-radio-group
            v-model="form.connectionMode"
            @change="onConnectionModeChange"
          >
            <el-radio-button
              value="standard"
              :disabled="form.dialect === 'generic'"
            >
              标准配置
            </el-radio-button>
            <el-radio-button value="custom">
              自定义运行时
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="variants.length > 1"
          label="连接变体"
        >
          <el-select
            v-model="form.variant"
            style="width: 100%"
          >
            <el-option
              v-for="variant in variants"
              :key="variant.key"
              :label="variant.name"
              :value="variant.key"
            />
          </el-select>
        </el-form-item>
      </div>

      <div
        v-if="form.dialect"
        class="form-section"
      >
        <div class="section-title">
          <el-icon><Icon :icon="iconMap.link" /></el-icon>
          <span>连接信息</span>
        </div>
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
              placeholder="数据库密码"
              show-password
              clearable
            />
          </el-form-item>
        </template>
        <template v-else>
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
              placeholder="数据库密码"
              show-password
              clearable
            />
          </el-form-item>
          <div class="form-tip">
            自定义模式不依赖平台内置映射；请配置当前 Puppet 已安装驱动对应的 JDBC 或 PDO
            连接。
          </div>
        </template>
        <el-form-item label="连接超时">
          <el-input-number
            v-model="form.timeoutSeconds"
            :min="1"
            :max="300"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="连接属性">
          <el-input
            v-model="form.optionsText"
            type="textarea"
            :rows="3"
            placeholder="JSON 对象，例如 {&quot;charset&quot;:&quot;utf8mb4&quot;}"
          />
        </el-form-item>
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
        </el-form-item>
        <div class="form-tip">
          SQL 方言只负责语句和元数据规则；运行时连接方式可独立覆盖。
        </div>
        <DatabaseRuntimeOverrides
          v-model="form.runtimeOptions"
          :capabilities="runtimeCapabilities"
          :loading="runtimeCapabilitiesLoading"
          @refresh="inspectRuntimeCapabilities"
        />
        <DatabaseConnectionDiagnostics :result="connectionTestResult" />
      </div>
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
          测试连接
        </el-button>
        <el-button
          type="primary"
          :loading="saving || testing"
          :disabled="!isComplete"
          @click="handleSaveConnection"
        >
          {{ saving && testing ? '测试中...' : saving ? '保存中...' : '保存并测试' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElNotification } from 'element-plus'
import { icons } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { validateForm, handleFormSubmit } from '@/utils/formUtils.js'
import {
  buildDatabaseConnection,
  createDatabaseConfigForm,
  databaseConfigFormRules,
  resetDatabaseConfigForm,
  useDatabaseConfigDialogBase,
  verifySavedDatabaseConnection
} from './database-config-dialog-shared.js'
import { saveDatabaseConnectionApi } from '@/services/api.js'
import { showWarning } from '@/utils/messageUtils.js'
import DatabaseConnectionDiagnostics from './DatabaseConnectionDiagnostics.vue'
import DatabaseRuntimeOverrides from './DatabaseRuntimeOverrides.vue'

const iconMap = icons

const props = defineProps({
  visible: { type: Boolean, default: false },
  sessionId: { type: String, required: true }
})

const emit = defineEmits(['update:visible', 'success', 'cancel'])

const templates = ref([])
const saving = ref(false)
const testing = ref(false)
const form = reactive(createDatabaseConfigForm())
const formRules = databaseConfigFormRules
const formRef = ref(null)
const {
  variants,
  visibleFields,
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

const onDialectChange = () => {
  syncDialectSelection()
  connectionTestResult.value = null
  inspectRuntimeCapabilities()
}

const onConnectionModeChange = () => {
  connectionTestResult.value = null
  inspectRuntimeCapabilities()
}

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

const handleTestConnection = async () => {
  if (!isComplete.value) {
    showWarning('请填写完整的连接信息')
    return
  }

  await executeRequest(
    async () => {
      const result = await runConnectionTest()
      if (!result) {
        throw new Error('连接测试失败')
      }
      return result
    },
    {
      loadingRef: testing,
      successMessage: null, // testConnectionOnly内部已经使用了ElNotification
      errorMessage: null // testConnectionOnly内部已经使用了ElNotification
    }
  )
}

const doSaveConnection = async () => {
  await handleFormSubmit(
    async () => {
      const requestData = {
        sessionId: props.sessionId,
        connection: buildDatabaseConnection(form)
      }

      const response = await saveDatabaseConnectionApi(requestData)
      try {
        await verifySavedDatabaseConnection({ sessionId: props.sessionId, response })
      } catch {
        ElNotification({
          title: '连接已保存',
          message: '保存后的连通性复检失败，状态已记录',
          type: 'warning'
        })
      }
      return response
    },
    {
      loadingRef: saving,
      successMessage: '数据库连接保存成功',
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

  // 先测试连接
  await executeRequest(
    async () => {
      const testResult = await runConnectionTest()
      if (!testResult) {
        throw new Error('连接测试失败，请检查配置后重试')
      }
      return testResult
    },
    {
      loadingRef: testing,
      successMessage: null, // testConnectionOnly内部已经使用了ElNotification
      errorMessage: '连接测试失败，请检查配置后重试'
    }
  )
    .then(async () => {
      // 测试成功后保存
      await doSaveConnection()
    })
    .catch(() => {
      // 测试失败，不执行保存
    })
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
  resetRuntimeState()
  resetDatabaseConfigForm(form, formRef)
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      resetRuntimeState()
      resetDatabaseConfigForm(form, formRef)
      loadDatabaseTemplates()
    }
  }
)
</script>

<style scoped>
@import '@/styles/database-config-dialog-shared.css';

.url-examples div {
  font-family: var(--el-font-family-mono);
  font-size: 0.6875rem;
  color: var(--el-text-color-regular);
  margin: var(--el-spacing-small) 0;
  line-height: 1.6;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-base);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>
