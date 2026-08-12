<template>
  <el-dialog
    v-model="dialogVisible"
    title="修改权限"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-chmod-dialog file-dialog-shell"
    append-to-body
    @close="handleClose"
  >
    <div class="chmod-content file-dialog-content">
      <FileOperationSummary
        :name="file.name"
        :path="filePath"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
      />

      <!-- 权限矩阵 -->
      <div class="perm-matrix">
        <div class="perm-header">
          <span class="perm-role-label" />
          <span class="perm-col-label">读 (r)</span>
          <span class="perm-col-label">写 (w)</span>
          <span class="perm-col-label">执行 (x)</span>
          <span class="perm-col-label octal-col">八进制</span>
        </div>
        <div
          v-for="role in roles"
          :key="role.key"
          class="perm-row"
        >
          <span class="perm-role-label">{{ role.label }}</span>
          <el-checkbox
            v-model="perms[role.key].r"
            @change="syncInput"
          />
          <el-checkbox
            v-model="perms[role.key].w"
            @change="syncInput"
          />
          <el-checkbox
            v-model="perms[role.key].x"
            @change="syncInput"
          />
          <span class="perm-octal">{{ roleOctal(role.key) }}</span>
        </div>
      </div>

      <!-- 八进制直接输入 -->
      <div class="octal-row">
        <span class="field-label">八进制权限</span>
        <el-input
          v-model="octalInput"
          placeholder="如 755 或 0755"
          size="small"
          class="octal-input"
          maxlength="4"
          @input="syncFromInput"
        />
        <span class="octal-hint">完整形式：{{ octalFull }}</span>
      </div>

      <!-- 递归选项（仅目录） -->
      <div
        v-if="file.isDirectory"
        class="recursive-row"
      >
        <el-checkbox v-model="recursive">
          递归修改目录内所有文件和子目录
        </el-checkbox>
      </div>

      <div class="dialog-footer file-dialog-footer chmod-actions">
        <el-button
          :disabled="processing"
          size="large"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="processing"
          :disabled="!octalValid"
          size="large"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          {{ processing ? '修改中...' : '确认修改' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import { chmodFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

const iconMap = icons

const props = defineProps({
  sessionId: { type: String, required: true },
  file: { type: Object, required: true },
  disk: { type: String, default: '/' },
  currentPath: { type: String, default: '' }
})

const emit = defineEmits(['refresh', 'close'])

const roles = [
  { key: 'owner', label: '所有者 (u)' },
  { key: 'group', label: '群组 (g)' },
  { key: 'other', label: '其他 (o)' }
]

const dialogVisible = ref(false)
const processing = ref(false)
const recursive = ref(false)
const octalInput = ref('644')

const perms = ref({
  owner: { r: true, w: true, x: false },
  group: { r: true, w: false, x: false },
  other: { r: true, w: false, x: false }
})

const roleOctal = (key) => {
  const p = perms.value[key]
  return String((p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0))
}

const octalFull = computed(() => {
  return `${roleOctal('owner')}${roleOctal('group')}${roleOctal('other')}`
})

const octalValid = computed(() => /^[0-7]{3,4}$/.test(octalInput.value.trim()))

// Sync checkboxes → input
const syncInput = () => {
  octalInput.value = octalFull.value
}

// Sync input → checkboxes
const syncFromInput = () => {
  const raw = octalInput.value.trim().replace(/^0/, '')
  if (!/^[0-7]{3}$/.test(raw)) return
  const bits = raw.split('').map(Number)
  const keys = ['owner', 'group', 'other']
  keys.forEach((k, i) => {
    perms.value[k].r = !!(bits[i] & 4)
    perms.value[k].w = !!(bits[i] & 2)
    perms.value[k].x = !!(bits[i] & 1)
  })
}

const filePath = computed(() =>
  formatFilePath(`${props.disk}${props.currentPath}/${props.file.name}`)
)

const fileIconPresentation = computed(() => getFileIconPresentation(props.file))

const summaryBadges = computed(() => [
  { label: props.file.isDirectory ? '文件夹' : (props.file.extension?.toUpperCase() || '文件') },
  { label: octalFull.value, type: octalValid.value ? 'primary' : 'danger' }
])

const parseOctalToPerms = (octalStr) => {
  const raw = octalStr.replace(/^0/, '')
  if (!/^[0-7]{3}$/.test(raw)) return
  const bits = raw.split('').map(Number)
  const keys = ['owner', 'group', 'other']
  keys.forEach((k, i) => {
    perms.value[k].r = !!(bits[i] & 4)
    perms.value[k].w = !!(bits[i] & 2)
    perms.value[k].x = !!(bits[i] & 1)
  })
  octalInput.value = raw
}

const openDialog = (initialMode) => {
  recursive.value = false
  // Try to set initial perms from existing file permissions if passed
  if (initialMode && /^[0-7]{3,4}$/.test(String(initialMode))) {
    parseOctalToPerms(String(initialMode))
  } else {
    // Derive from canRead/canWrite/canExecute booleans as a best-effort default
    const f = props.file
    perms.value.owner.r = !!f.canRead
    perms.value.owner.w = !!f.canWrite
    perms.value.owner.x = !!f.canExecute
    perms.value.group.r = !!f.canRead
    perms.value.group.w = false
    perms.value.group.x = !!f.canExecute
    perms.value.other.r = !!f.canRead
    perms.value.other.w = false
    perms.value.other.x = false
    syncInput()
  }
  dialogVisible.value = true
}

const handleClose = () => {
  if (processing.value) return
  dialogVisible.value = false
  emit('close')
}

const handleSubmit = async () => {
  if (!octalValid.value || processing.value) return
  processing.value = true
  try {
    const mode = octalInput.value.trim().replace(/^0/, '')
    await chmodFileApi({
      sessionId: props.sessionId,
      path: filePath.value,
      mode,
      recursive: props.file.isDirectory ? recursive.value : false
    })
    showSuccess('权限修改成功')
    dialogVisible.value = false
    emit('refresh')
    emit('close')
  } catch (error) {
    showError(error.message || '权限修改失败，请重试')
  } finally {
    processing.value = false
  }
}

defineExpose({ openDialog })
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-chmod-dialog {
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.file-chmod-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-dialog-soft-border);
  box-shadow: var(--app-shell-shadow-strong);
}

.chmod-content {
  padding: 0;
}

/* ── Permission matrix ─────────────────────────────────────── */
.perm-matrix {
  background: var(--app-control-background-soft);
  border: 1px solid var(--file-dialog-soft-border);
  border-radius: 12px;
  overflow: hidden;
}

.perm-header,
.perm-row {
  display: grid;
  grid-template-columns: 130px 1fr 1fr 1fr 60px;
  align-items: center;
  padding: 8px 14px;
  gap: 8px;
}

.perm-header {
  background: color-mix(in srgb, var(--app-control-background) 60%, transparent);
  border-bottom: 1px solid var(--file-dialog-soft-border);
}

.perm-row + .perm-row {
  border-top: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 60%, transparent);
}

.perm-col-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.perm-role-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.perm-row :deep(.el-checkbox) {
  justify-self: center;
}

.perm-octal {
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--el-color-primary);
  text-align: center;
}

.octal-col {
  text-align: center;
}

/* ── Octal row ──────────────────────────────────────────────── */
.octal-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.octal-input {
  width: 100px;
  flex-shrink: 0;
}

.octal-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  font-family: var(--el-font-family-mono);
}

.octal-hint {
  font-size: 12px;
  font-family: var(--el-font-family-mono);
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

/* ── Recursive ──────────────────────────────────────────────── */
.recursive-row {
  padding: 10px 12px;
  background: color-mix(in srgb, var(--el-color-warning) 6%, var(--app-control-background-soft));
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 18%, transparent);
  border-radius: 10px;
  font-size: 13px;
}

.chmod-actions {
  margin-top: 4px;
}

.file-chmod-dialog :deep(.el-dialog__footer) {
  display: none;
}
</style>
