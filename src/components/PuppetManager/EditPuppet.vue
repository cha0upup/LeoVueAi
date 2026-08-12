<template>
  <el-dialog
    v-model="editPuppetDialog"
    width="900px"
    top="4vh"
    draggable
    class="puppet-dialog edit-puppet-dialog"
    @opened="scrollFormToTop"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-main">
          <div class="intro-title-row">
            <el-icon class="intro-icon">
              <Icon :icon="iconMap.edit" />
            </el-icon>
            <div>
              <h3>调整主机配置</h3>
            </div>
          </div>
        </div>
      </div>
    </template>

    <PuppetFormFields
      ref="formRef"
      v-model:puppet="puppet"
      v-model:proxy-enabled="proxyEnabled"
      v-model:url-strategy-enabled="urlStrategyEnabled"
      v-model:url-strategy-form="urlStrategyForm"
      v-model:padding-enabled="paddingEnabled"
      v-model:padding-preset="paddingPreset"
      v-model:padding-form="paddingForm"
      v-model:header-noise-enabled="headerNoiseEnabled"
      v-model:header-noise-form="headerNoiseForm"
      v-model:tls-fingerprint-enabled="tlsFingerprintEnabled"
      v-model:tls-fingerprint-form="tlsFingerprintForm"
      :rules="rules"
      :disguises="allDisguises"
      :probing="probing"
      @submit="handleEdit"
      @probe="handleProbe"
      @apply-padding-preset="applyPaddingPreset"
    />

    <template #footer>
      <div class="dialog-footer-stack">
        <PuppetConnectionResultBanner
          v-if="testResult"
          class="form-test-result"
          :result="testResult"
          @dismiss="testResult = null"
        />
        <div class="dialog-footer-actions">
          <el-button
            class="cancel-btn"
            @click="close"
          >
            取消
          </el-button>
          <el-button
            class="test-btn"
            :loading="testingConnection"
            :disabled="loading"
            @click="testConnection"
          >
            <el-icon v-if="!testingConnection">
              <Icon :icon="iconMap.test" />
            </el-icon>
            测试连接
          </el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="testingConnection"
            class="submit-btn"
            @click="handleEdit"
          >
            <el-icon><Icon :icon="iconMap.check" /></el-icon>
            {{ loading ? '更新中...' : '更新主机' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { createDefaultPuppet } from '@/utils/constants.js'
import { useEditDialog } from '@/utils/dialogUtils.js'
import { validateForm, handleFormSubmit, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { getAllDisguises } from '@/utils/puppetUtils.js'
import { formatHeadersForEditor, stringifyHeadersForSubmit } from '@/utils/headers.js'
import { usePuppetStrategies } from '@/composables/usePuppetStrategies.js'
import { usePuppetUrlProbe } from '@/composables/usePuppetUrlProbe.js'
import { usePuppetConfigTest } from '@/composables/usePuppetConfigTest.js'
import PuppetFormFields from './PuppetFormFields.vue'
import PuppetConnectionResultBanner from './PuppetConnectionResultBanner.vue'
import { updatePuppetApi } from '@/services/api.js'
import { createPuppetDialogRules } from '@/components/PuppetManager/puppetFormShared.js'

const iconMap = icons

const emit = defineEmits(['refresh'])

// 使用编辑对话框工具
const editDialog = useEditDialog()
const editPuppetDialog = editDialog.visible

const loading = ref(false)
const proxyEnabled = ref(false)
const formRef = ref(null)
const scrollFormToTop = () => formRef.value?.scrollToTop?.()
const {
  urlStrategyEnabled,
  urlStrategyForm,
  paddingEnabled,
  paddingPreset,
  paddingForm,
  headerNoiseEnabled,
  headerNoiseForm,
  tlsFingerprintEnabled,
  tlsFingerprintForm,
  resetStrategies,
  loadStrategies,
  applyPaddingPreset,
  mergeUrlPoolPaths,
  buildUrlStrategyJson,
  buildPaddingStrategyJson,
  buildHeaderNoiseStrategyJson,
  buildTlsFingerprintStrategyJson
} = usePuppetStrategies()

const allDisguises = ref([])

// 使用默认值创建puppet对象
const puppet = reactive(createDefaultPuppet())

const rules = createPuppetDialogRules({ requireDisguises: true })

const buildPuppetPayload = () => ({
  ...puppet,
  proxyEnabled: proxyEnabled.value ? 1 : 0,
  headers: stringifyHeadersForSubmit(puppet.headers),
  urlStrategy: buildUrlStrategyJson(),
  paddingStrategy: buildPaddingStrategyJson(),
  headerNoiseStrategy: buildHeaderNoiseStrategyJson(),
  tlsFingerprintStrategy: buildTlsFingerprintStrategyJson()
})

const validateCurrentForm = () =>
  validateForm(formRef, { errorMessage: '表单验证失败，请检查输入' })

const {
  testing: testingConnection,
  result: testResult,
  reset: resetConnectionTest,
  testConnection
} = usePuppetConfigTest({ validate: validateCurrentForm, buildPayload: buildPuppetPayload })

watch(
  [
    puppet,
    proxyEnabled,
    urlStrategyEnabled,
    urlStrategyForm,
    paddingEnabled,
    paddingPreset,
    paddingForm,
    headerNoiseEnabled,
    headerNoiseForm,
    tlsFingerprintEnabled,
    tlsFingerprintForm
  ],
  resetConnectionTest,
  { deep: true }
)

const getAllDisguise = async () => {
  allDisguises.value = await getAllDisguises()
}

const resetForm = () => {
  resetFormUtil(formRef, puppet, createDefaultPuppet())
  proxyEnabled.value = false
  resetStrategies()
  cancelProbe()
  resetConnectionTest()
}

const close = () => {
  editDialog.close()
  resetForm()
}

const openEditPuppetDialog = (puppetData) => {
  editDialog.open(puppetData)
  Object.assign(puppet, createDefaultPuppet(puppetData))
  puppet.headers = formatHeadersForEditor(puppetData.headers)
  proxyEnabled.value = puppet.proxyEnabled == 1
  loadStrategies(puppetData)
  resetConnectionTest()
}

const {
  probing,
  probePaths: handleProbe,
  cancelProbe
} = usePuppetUrlProbe({
  getBaseUrl: () => puppet.connLink,
  mergePaths: mergeUrlPoolPaths
})

const handleEdit = async () => {
  // 验证表单
  const isValid = await validateCurrentForm()
  if (!isValid) return

  // 处理表单提交
  await handleFormSubmit(
    async () => {
      const response = await updatePuppetApi(buildPuppetPayload())
      return response
    },
    {
      loadingRef: loading,
      successMessage: '主机更新成功！',
      errorMessage: '更新失败，请稍后重试',
      onSuccess: () => {
        emit('refresh')
        close()
      }
    }
  )
}

onMounted(() => {
  getAllDisguise()
})

defineExpose({
  openEditPuppetDialog,
  close
})
</script>

<style scoped>
@import '@/styles/puppet-form-dialog-shared.css';
</style>
