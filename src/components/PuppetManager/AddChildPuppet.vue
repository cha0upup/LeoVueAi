<template>
  <el-dialog
    v-model="addChildPuppetDialog"
    width="900px"
    top="4vh"
    draggable
    class="puppet-dialog add-child-puppet-dialog"
    @opened="scrollFormToTop"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-title-row">
          <el-icon class="intro-icon">
            <Icon :icon="iconMap.parasite" />
          </el-icon>
          <div>
            <h3>添加寄生主机</h3>
          </div>
        </div>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="childPuppet"
      :rules="rules"
      label-width="120px"
      label-position="left"
      class="host-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 父主机信息 -->
      <div class="form-section parent-info">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="parent-item">
              <span class="parent-label">父主机名称：</span>
              <span class="parent-value">{{ parentPuppetName || '未选择' }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="parent-item">
              <span class="parent-label">父主机地址：</span>
              <span class="parent-value">{{ parentConnLink || '未选择' }}</span>
            </div>
          </el-col>
        </el-row>
      </div>

      <div class="form-section">
        <div class="section-heading">
          <div>
            <strong>连接信息</strong>
          </div>
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item
              label="主机名称"
              prop="puppetName"
            >
              <el-input
                v-model="childPuppet.puppetName"
                placeholder="请输入寄生主机名称"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              label="连接地址"
              prop="connLink"
            >
              <el-input
                v-model="childPuppet.connLink"
                placeholder="请输入寄生主机连接地址"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item
              label="传输协议"
              prop="protocol"
            >
              <el-select
                v-model="childPuppet.protocol"
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
            <el-form-item
              label="节点类型"
              prop="type"
            >
              <el-select
                v-model="childPuppet.type"
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
            <el-form-item
              label="访问权限"
              prop="permission"
            >
              <el-select
                v-model="childPuppet.permission"
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
                      <Icon
                        v-if="item.value === 'public'"
                        :icon="iconMap.check"
                      />
                      <Icon
                        v-else-if="item.value === 'team'"
                        :icon="iconMap.user"
                      />
                      <Icon
                        v-else-if="item.value === 'private'"
                        :icon="iconMap.lock"
                      />
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
              <el-form-item
                label="请求伪装"
                prop="reqDisguiseId"
                required
              >
                <el-select
                  v-model="childPuppet.reqDisguiseId"
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
              <el-form-item
                label="响应伪装"
                prop="respDisguiseId"
                required
              >
                <el-select
                  v-model="childPuppet.respDisguiseId"
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
        </div>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item
              label="请求头信息"
              prop="headers"
            >
              <el-input
                v-model="childPuppet.headers"
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
            <el-form-item
              prop="maxReqCount"
            >
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
                v-model="childPuppet.maxReqCount"
                :min="PUPPET_MIN_REQUEST_COUNT"
                :max="PUPPET_MAX_REQUEST_COUNT"
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
              <el-form-item
                label="代理类型"
                prop="proxyType"
              >
                <el-select
                  v-model="childPuppet.proxyType"
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
              <el-form-item
                label="代理地址"
                prop="proxyHost"
              >
                <el-input
                  v-model="childPuppet.proxyHost"
                  placeholder="请输入代理地址"
                  clearable
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                label="代理端口"
                prop="proxyPort"
              >
                <el-input-number
                  v-model="childPuppet.proxyPort"
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
        <el-button
          type="danger"
          class="cancel-btn"
          @click="close"
        >
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="loading"
          class="submit-btn"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          {{ loading ? '添加中...' : '添加寄生主机' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { icons } from '@/utils/icons.js'
import {
  createDefaultPuppet,
  PUPPET_MAX_REQUEST_COUNT,
  PUPPET_MIN_REQUEST_COUNT
} from '@/utils/constants.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { validateForm, handleFormSubmit, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { getAllDisguises } from '@/utils/puppetUtils.js'
import { stringifyHeadersForSubmit } from '@/utils/headers.js'
import { addPuppetApi } from '@/services/api.js'
import {
  createPuppetDialogRules,
  PUPPET_PERMISSION_OPTIONS,
  PUPPET_PROTOCOL_OPTIONS,
  PUPPET_TYPE_OPTIONS,
  PUPPET_PROXY_OPTIONS
} from '@/components/PuppetManager/puppetFormShared.js'

const iconMap = icons

const emit = defineEmits(['refresh'])

// 使用对话框工具
const dialog = useDialog()
const addChildPuppetDialog = dialog.visible

const proxyEnabled = ref(false)
const loading = ref(false)
const allDisguises = ref([])
const permissions = PUPPET_PERMISSION_OPTIONS
const allProtocol = PUPPET_PROTOCOL_OPTIONS
const allTypes = PUPPET_TYPE_OPTIONS
const proxyOptions = PUPPET_PROXY_OPTIONS
const parentConnLink = ref('')
const parentPuppetName = ref('')

// 使用默认值创建childPuppet对象
const childPuppet = reactive(createDefaultPuppet())

const rules = createPuppetDialogRules({
  nameRequiredMessage: '请输入寄生主机名称',
  connLinkPattern: /^https?:\/\/.+/,
  connLinkPatternMessage: '请输入有效的连接地址',
  requireDisguises: true
})

const formRef = ref(null)
const scrollFormToTop = () => {
  const formElement = formRef.value?.$el
  if (formElement) formElement.scrollTop = 0
}

const getAllDisguise = async () => {
  allDisguises.value = await getAllDisguises()
}

const resetForm = () => {
  const parentId = childPuppet.parentPuppetId || ''
  resetFormUtil(formRef, childPuppet, createDefaultPuppet({ parentPuppetId: parentId }))
  proxyEnabled.value = false
  parentPuppetName.value = ''
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
  await handleFormSubmit(
    async () => {
      childPuppet.proxyEnabled = proxyEnabled.value ? 1 : 0
      childPuppet.headers = stringifyHeadersForSubmit(childPuppet.headers)
      const response = await addPuppetApi(childPuppet)
      return response
    },
    {
      loadingRef: loading,
      successMessage: '寄生主机添加成功！',
      errorMessage: '添加失败，请稍后重试',
      onSuccess: () => {
        refresh()
        close()
      }
    }
  )
}

const openAddChildPuppet = (
  parentPuppetId,
  parentConnLinkValue = '',
  parentPuppetNameValue = ''
) => {
  dialog.open()
  resetForm()
  // 在 resetForm 之后设置父主机信息，避免被重置
  childPuppet.parentPuppetId = parentPuppetId
  parentConnLink.value = parentConnLinkValue
  parentPuppetName.value = parentPuppetNameValue
}

onMounted(() => {
  getAllDisguise()
})

defineExpose({
  openAddChildPuppet,
  close
})
</script>

<style scoped>
@import '@/styles/puppet-form-dialog-shared.css';

/* 父主机信息 */
.parent-info {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: var(--radius-container);
  background: color-mix(in srgb, var(--el-color-warning) 9%, var(--dialog-surface-muted));
  border: 1px solid color-mix(in srgb, var(--el-color-warning-light-6) 54%, transparent);
}

.parent-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-container);
  background: var(--dialog-surface-muted);
}

.parent-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.parent-value {
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 600;
  word-break: break-all;
}

.submit-btn {
  min-width: 148px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .parent-info .el-col {
    margin-bottom: 8px;
  }
}
</style>
