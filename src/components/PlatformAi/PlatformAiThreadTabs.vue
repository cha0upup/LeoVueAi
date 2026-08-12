<template>
  <div class="thread-tabs-bar">
    <el-tabs
      :model-value="modelValue"
      type="card"
      :closable="threads.length > 1"
      @update:model-value="$emit('activate', $event)"
      @tab-remove="$emit('delete', $event)"
    >
      <el-tab-pane
        v-for="thread in threads"
        :key="thread.threadId"
        :label="thread.title || '未命名对话'"
        :name="thread.threadId"
      >
        <template #label>
          <span class="tab-label">
            <span
              class="tab-status-dot"
              :class="`is-${getPlatformThreadStatus(thread, conversationStatus)}`"
            />
            <input
              v-if="renamingThreadId === thread.threadId"
              ref="renameInputRef"
              v-model="renameValue"
              class="tab-rename-input"
              maxlength="50"
              @keydown.enter.stop="commitRename(thread)"
              @keydown.esc.stop="cancelRename"
              @blur="commitRename(thread)"
              @click.stop
            >
            <span
              v-else
              class="tab-title-text"
              @dblclick.stop="startRename(thread)"
            >{{ thread.title || '未命名对话' }}</span>
          </span>
        </template>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { getPlatformThreadStatus } from './platformAiAssistantModel.js'

defineProps({
  modelValue: { type: String, default: null },
  threads: { type: Array, default: () => [] },
  conversationStatus: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['activate', 'delete', 'rename'])
const renamingThreadId = ref(null)
const renameValue = ref('')
const renameInputRef = ref(null)

const startRename = thread => {
  renamingThreadId.value = thread.threadId
  renameValue.value = thread.title || ''
  nextTick(() => {
    const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
    input?.select()
  })
}

const cancelRename = () => {
  renamingThreadId.value = null
  renameValue.value = ''
}

const commitRename = thread => {
  if (renamingThreadId.value !== thread.threadId) return
  const title = renameValue.value.trim()
  cancelRename()
  if (title && title !== thread.title) emit('rename', { threadId: thread.threadId, title })
}
</script>

<style scoped>
.thread-tabs-bar { display:flex; align-items:stretch; flex-shrink:0; padding:5px 12px; min-height:42px; background:color-mix(in srgb, var(--app-control-background-soft) 90%, transparent); }
.thread-tabs-bar :deep(.el-tabs) { flex:1; min-width:0; overflow:hidden; }
.thread-tabs-bar :deep(.el-tabs__header) { margin:0; border:0; }
.thread-tabs-bar :deep(.el-tabs__nav-wrap), .thread-tabs-bar :deep(.el-tabs__nav-scroll) { overflow:hidden; }
.thread-tabs-bar :deep(.el-tabs__nav-wrap::after) { display:none; }
.thread-tabs-bar :deep(.el-tabs__nav) { border:0; }
.thread-tabs-bar :deep(.el-tabs__item) { height:31px; line-height:31px; padding:0 11px; margin:0 5px 0 0; border:0; border-radius:9px; font-size:12px; color:var(--el-text-color-secondary); background:transparent; transition:background .15s,color .15s; }
.thread-tabs-bar :deep(.el-tabs__item:hover) { color:var(--el-text-color-primary); background:color-mix(in srgb, var(--el-text-color-primary) 4%, transparent); }
.thread-tabs-bar :deep(.el-tabs__item.is-active) { color:var(--el-color-primary); background:var(--app-selected-background); font-weight:600; }
.thread-tabs-bar :deep(.el-tabs__item .el-icon-close) { width:16px; height:16px; margin-left:4px; border-radius:999px; font-size:12px; line-height:16px; }
.tab-label { display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.tab-status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; background:var(--el-text-color-placeholder); }
.tab-status-dot.is-running { background:var(--el-color-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--el-color-primary) 18%, transparent); animation:tab-pulse 1.4s ease-in-out infinite; }
.tab-status-dot.is-waiting_for_user { background:var(--el-color-warning); box-shadow:0 0 0 3px color-mix(in srgb, var(--el-color-warning) 18%, transparent); }
.tab-status-dot.is-failed { background:var(--el-color-danger); }
.tab-status-dot.is-cancelled { background:var(--el-text-color-placeholder); }
.tab-status-dot.is-completed, .tab-status-dot.is-done { background:var(--el-color-success); }
.tab-title-text { max-width:120px; overflow:hidden; text-overflow:ellipsis; cursor:default; }
.tab-rename-input { width:100px; max-width:120px; height:20px; padding:0 4px; border:1px solid var(--el-color-primary); border-radius:3px; outline:none; background:var(--app-surface-background); color:var(--el-text-color-primary); font-size:12px; line-height:20px; }
@keyframes tab-pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
</style>
