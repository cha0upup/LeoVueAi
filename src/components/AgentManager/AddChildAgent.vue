<template>
  <el-dialog
    v-model="addChildAgentDialog"
    width="900px"
    top="4vh"
    draggable
    class="agent-dialog add-child-agent-dialog"
    @opened="scrollFormToTop"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-title-row">
          <el-icon class="intro-icon">
            <Icon :icon="iconMap.childAgent" />
          </el-icon>
          <div>
            <h3>添加子节点主机</h3>
          </div>
        </div>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="childAgent"
      :rules="rules"
      label-width="120px"
      label-position="left"
      class="host-form"
      @submit.prevent="handleSubmit"
    >
      <ParentHostSummary
        :host="parentAgent"
        :status="parentRuntimeStatus.status"
        :status-label="parentRuntimeStatus.label"
      />

      <div class="form-section">
        <div class="section-heading">
          <div>
            <strong>连接信息</strong>
          </div>
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="主机名称" prop="agentName">
              <el-input
                v-model="childAgent.agentName"
                placeholder="请输入子节点主机名称"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="连接地址" prop="connLink">
              <el-input
                v-model="childAgent.connLink"
                placeholder="请输入子节点主机连接地址"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="传输协议" prop="protocol">
              <el-select
                v-model="childAgent.protocol"
                placeholder="请选择传输协议"
                style="width: 100%"
              >
                <el-option
                  v-for="item in allProtocol"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <div class="option-content">
                    <el-icon class="option-icon">
                      <Icon :icon="iconMap.connection" />
                    </el-icon>
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="节点类型" prop="type">
              <el-select
                v-model="childAgent.type"
                placeholder="请选择节点类型"
                style="width: 100%"
              >
                <el-option
                  v-for="item in allTypes"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <div class="option-content">
                    <el-icon class="option-icon">
                      <Icon :icon="iconMap.code" />
                    </el-icon>
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="访问权限" prop="permission">
              <el-select
                v-model="childAgent.permission"
                placeholder="请选择访问权限"
                style="width: 100%"
              >
                <el-option
                  v-for="item in permissions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <div class="option-content">
                    <el-icon class="option-icon">
                      <Icon v-if="item.value === 'public'" :icon="iconMap.check" />
                      <Icon v-else-if="item.value === 'team'" :icon="iconMap.user" />
                      <Icon v-else-if="item.value === 'private'" :icon="iconMap.lock" />
                    </el-icon>
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="section-heading section-heading--spaced">
          <div>
            <strong>伪装配置</strong>
          </div>
        </div>

        <div class="disguise-required-panel">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="请求伪装" prop="reqDisguiseId" required>
                <el-select
                  v-model="childAgent.reqDisguiseId"
                  placeholder="请选择请求伪装"
                  style="width: 100%"
                  clearable
                  filterable
                >
                  <el-option
                    v-for="item in allDisguises"
                    :key="item.disguiseId"
                    :label="`${item.disguiseName} (${item.disguiseId})`"
                    :value="item.disguiseId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="响应伪装" prop="respDisguiseId" required>
                <el-select
                  v-model="childAgent.respDisguiseId"
                  placeholder="请选择响应伪装"
                  style="width: 100%"
                  clearable
                  filterable
                >
                  <el-option
                    v-for="item in allDisguises"
                    :key="item.disguiseId"
                    :label="`${item.disguiseName} (${item.disguiseId})`"
                    :value="item.disguiseId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col v-if="childAgent.type === 'java'" :span="12">
              <el-form-item label="AES 密钥" prop="payloadKey" required>
                <el-input
                  v-model="childAgent.payloadKey"
                  clearable
                  placeholder="请输入 AES 密钥"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="请求头信息" prop="headers">
              <el-input
                v-model="childAgent.headers"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="请输入请求头信息，格式：key: value"
                class="headers-textarea"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="section-heading section-heading--spaced">
          <div>
            <strong>连接策略</strong>
          </div>
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="maxReqCount">
              <template #label>
                <span class="field-label-with-help">
                  最大请求数
                  <el-tooltip
                    content="包含首次请求；1 表示不重试，3 表示最多重试 2 次。"
                    placement="top"
                  >
                    <el-icon class="field-help-icon">
                      <Icon :icon="iconMap.infoCard" />
                    </el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input-number
                v-model="childAgent.maxReqCount"
                :min="AGENT_MIN_REQUEST_COUNT"
                :max="AGENT_MAX_REQUEST_COUNT"
                placeholder="请输入最大请求数"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="启用代理">
              <el-switch
                v-model="proxyEnabled"
                active-text="启用"
                inactive-text="禁用"
                inline-prompt
              />
            </el-form-item>
          </el-col>
        </el-row>

        <template v-if="proxyEnabled">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="代理类型" prop="proxyType">
                <el-select
                  v-model="childAgent.proxyType"
                  placeholder="请选择代理类型"
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in proxyOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="代理地址" prop="proxyHost">
                <el-input v-model="childAgent.proxyHost" placeholder="请输入代理地址" clearable />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="代理端口" prop="proxyPort">
                <el-input-number
                  v-model="childAgent.proxyPort"
                  :min="1"
                  :max="65535"
                  placeholder="端口"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer-actions">
        <el-button type="danger" class="cancel-btn" @click="close">
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          取消
        </el-button>
        <el-button type="primary" :loading="loading" class="submit-btn" @click="handleSubmit">
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          {{ loading ? '添加中...' : '添加子节点主机' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { icons } from '@/utils/icons.js'
import {
  createDefaultAgent,
  AGENT_MAX_REQUEST_COUNT,
  AGENT_MIN_REQUEST_COUNT
} from '@/utils/constants.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { validateForm, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { getAllDisguises } from '@/utils/agentUtils.js'
import { stringifyHeadersForSubmit } from '@/utils/headers.js'
import { addAgentApi } from '@/services/api/agent-manage.js'
import ParentHostSummary from './ParentHostSummary.vue'
import {
  createAgentDialogRules,
  AGENT_PERMISSION_OPTIONS,
  AGENT_PROTOCOL_OPTIONS,
  AGENT_TYPE_OPTIONS,
  AGENT_PROXY_OPTIONS
} from '@/components/AgentManager/agentFormShared.js'

const iconMap = icons

const emit = defineEmits(['refresh'])

// 使用对话框工具
const dialog = useDialog()
const addChildAgentDialog = dialog.visible

const proxyEnabled = ref(false)
const loading = ref(false)
const allDisguises = ref([])
const permissions = AGENT_PERMISSION_OPTIONS
const allProtocol = AGENT_PROTOCOL_OPTIONS
const allTypes = AGENT_TYPE_OPTIONS
const proxyOptions = AGENT_PROXY_OPTIONS
const parentAgent = ref(null)
const parentRuntimeStatus = ref({ status: 'untested', label: '' })

// 使用默认值创建childAgent对象
const childAgent = reactive(createDefaultAgent())

const rules = createAgentDialogRules({
  nameRequiredMessage: '请输入子节点主机名称',
  connLinkPattern: /^https?:\/\/.+/,
  connLinkPatternMessage: '请输入有效的连接地址',
  requireDisguises: true,
  requirePayloadKeyForJava: () => childAgent.type === 'java'
})

const formRef = ref(null)
const scrollFormToTop = () => {
  const formElement = formRef.value?.$el
  if (formElement) formElement.scrollTop = 0
}

const loadDisguises = async () => {
  allDisguises.value = await getAllDisguises()
}

const resetForm = () => {
  const parentId = childAgent.parentAgentId || ''
  resetFormUtil(formRef, childAgent, createDefaultAgent({ parentAgentId: parentId }))
  proxyEnabled.value = false
  parentAgent.value = null
  parentRuntimeStatus.value = { status: 'untested', label: '' }
}

const close = () => {
  dialog.close()
  resetForm()
}

const refresh = () => {
  emit('refresh')
}

const handleSubmit = async () => {
  // 验证表单
  const isValid = await validateForm(formRef, {
    errorMessage: '表单验证失败，请检查输入'
  })
  if (!isValid) return

  // 处理表单提交
  await executeRequest(
    () => {
      childAgent.proxyEnabled = proxyEnabled.value ? 1 : 0
      childAgent.headers = stringifyHeadersForSubmit(childAgent.headers)
      return addAgentApi(childAgent)
    },
    {
      loadingRef: loading,
      successMessage: '子节点主机添加成功！',
      errorMessage: '添加失败，请稍后重试',
      onSuccess: () => {
        refresh()
        close()
      }
    }
  )
}

const openAddChildAgent = (parentAgentConfig, runtimeStatus = {}) => {
  dialog.open()
  resetForm()
  // 在 resetForm 之后设置父主机信息，避免被重置
  childAgent.parentAgentId = parentAgentConfig?.agentId || ''
  parentAgent.value = parentAgentConfig || null
  parentRuntimeStatus.value = {
    status: runtimeStatus.status || 'untested',
    label: runtimeStatus.label || ''
  }
}

onMounted(() => {
  loadDisguises()
})

defineExpose({
  openAddChildAgent,
  close
})
</script>

<style scoped>
@import '@/styles/agent-form-dialog-shared.css';

.submit-btn {
  min-width: 148px;
}
</style>
