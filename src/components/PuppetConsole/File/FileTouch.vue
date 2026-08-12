<template>
  <el-dialog
    v-model="visible"
    title="修改时间戳"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-touch-dialog file-dialog-shell"
    modal-class="file-touch-modal"
    append-to-body
    align-center
    @close="handleClose"
  >
    <div class="touch-shell file-dialog-content">
      <FileOperationSummary
        :name="targetName"
        :path="targetPath"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
      />

      <el-form
        label-position="top"
        size="default"
        class="touch-form"
      >
        <el-form-item label="新时间">
          <div class="time-row">
            <el-date-picker
              v-model="newTime"
              class="time-picker"
              type="datetime"
              placeholder="选择新的修改时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              clearable
              popper-class="file-touch-date-popper"
            />
            <el-button
              size="small"
              class="now-btn"
              @click="newTime = formatNow()"
            >
              现在
            </el-button>
          </div>
          <p class="field-hint">
            可手动选择日期和时间；清空后由后端使用执行时的当前时间。
          </p>
        </el-form-item>
        <el-form-item
          v-if="isDir"
          label="递归修改"
        >
          <el-switch v-model="recursive" />
          <span class="hint-text">对目录下所有文件和子目录生效</span>
        </el-form-item>
      </el-form>

      <div
        v-if="resultMsg"
        class="result-msg"
        :class="{ 'result-ok': resultOk, 'result-err': !resultOk }"
      >
        <el-icon class="result-icon">
          <Icon :icon="resultOk ? iconMap.circleCheck : iconMap.error" />
        </el-icon>
        <span>{{ resultMsg }}</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">
        {{ resultOk ? '关闭' : '取消' }}
      </el-button>
      <el-button
        v-if="!resultOk"
        type="primary"
        :loading="loading"
        @click="doTouch"
      >
        确认修改
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { fileTouchApi } from '@/services/api/puppet-files.js'
import { showSuccess } from '@/utils/messageUtils.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

const iconMap = icons

const props = defineProps({
  sessionId: { type: String, required: true }
})

const visible = ref(false)
const loading = ref(false)
const targetPath = ref('')
const isDir = ref(false)
const newTime = ref('')
const recursive = ref(false)
const resultMsg = ref('')
const resultOk = ref(false)

const targetName = computed(() => targetPath.value.split('/').filter(Boolean).pop() || targetPath.value || '未知文件')

const fileIconPresentation = computed(() => getFileIconPresentation({
  name: targetName.value,
  isDirectory: isDir.value
}))

const summaryBadges = computed(() => [
  { label: isDir.value ? '文件夹' : '文件' },
  { label: newTime.value || '执行时当前时间', type: 'info' }
])

function openDialog(path, dir = false) {
  targetPath.value = path
  isDir.value = dir
  newTime.value = formatNow()
  recursive.value = false
  resultMsg.value = ''
  resultOk.value = false
  visible.value = true
}

function formatNow() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function doTouch() {
  loading.value = true
  resultMsg.value = ''
  try {
    const res = await fileTouchApi({
      sessionId: props.sessionId,
      path: targetPath.value,
      time: newTime.value || undefined,
      recursive: recursive.value
    })
    // 拦截器已解包 ApiResponse，res.data 即内层结果
    const data = res.data
    if (data?.modifiedCount !== undefined || data?.newTime) {
      resultOk.value = true
      resultMsg.value = `修改成功，共修改 ${data.modifiedCount ?? 1} 个文件，新时间：${data.newTime ?? '当前时间'}`
      showSuccess('时间戳修改成功')
    } else {
      resultOk.value = false
      resultMsg.value = data?.msg || '修改失败'
    }
  } catch (e) {
    resultOk.value = false
    resultMsg.value = e?.response?.data?.msg || e.message || '请求失败'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  resultMsg.value = ''
  resultOk.value = false
}

defineExpose({ openDialog })
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-touch-dialog {
  --file-dialog-muted-surface: var(--app-dialog-intro-background);
  --file-dialog-raised-surface: var(--app-dialog-subtle-background);
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

:global(.file-touch-modal) {
  background-color: rgba(17, 24, 39, 0.54);
  backdrop-filter: blur(1px);
}

:global(html.dark .file-touch-modal),
:global(html[data-theme='dark'] .file-touch-modal) {
  background-color: rgba(2, 6, 23, 0.66);
}

:global(.file-touch-date-popper.el-picker__popper.el-popper) {
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 54%, transparent);
  border-radius: 12px;
  background: var(--app-dialog-background);
  box-shadow: 0 18px 42px color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
}

:global(.file-touch-date-popper .el-picker-panel) {
  border-radius: 12px;
}

:global(.file-touch-date-popper .el-picker-panel__body),
:global(.file-touch-date-popper .el-picker-panel__footer) {
  background: var(--app-dialog-background);
}

:global(.file-touch-date-popper .el-picker-panel__footer) {
  border-top-color: color-mix(in srgb, var(--el-border-color) 46%, transparent);
}

:global(html:not(.dark) .file-touch-dialog),
:global(html[data-theme='light'] .file-touch-dialog) {
  --file-dialog-muted-surface: #f3f2ef;
  --file-dialog-raised-surface: #f8f7f4;
  --file-dialog-soft-border: rgba(24, 24, 27, 0.08);
}

.touch-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.touch-form {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  background: var(--file-dialog-raised-surface);
}

.touch-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.touch-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.touch-form :deep(.el-form-item__label) {
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.time-picker {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.time-picker :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 100%, transparent);
  background: var(--app-dialog-background);
  box-shadow: none;
}

.time-picker :deep(.el-input__wrapper:hover),
.time-picker :deep(.el-input__wrapper.is-focus) {
  border-color: color-mix(in srgb, var(--el-color-primary) 42%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.now-btn {
  flex-shrink: 0;
  font-size: 12px;
}

.field-hint {
  width: 100%;
  margin: 7px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  line-height: 1.45;
}

.hint-text {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.result-msg {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid currentColor;
  font-size: 13px;
}

.result-icon {
  flex-shrink: 0;
  font-size: 15px;
}

.result-ok {
  background: color-mix(in srgb, var(--el-color-success) 10%, transparent);
  color: var(--el-color-success);
}

.result-err {
  background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
  color: var(--el-color-danger);
}

@media (max-width: 768px) {
  .time-row {
    align-items: stretch;
    flex-direction: column;
  }

  .now-btn {
    width: 100%;
  }
}
</style>
