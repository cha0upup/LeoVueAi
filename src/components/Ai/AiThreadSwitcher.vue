<template>
  <div class="thread-switcher">
    <el-popover
      v-model:visible="opened"
      trigger="click"
      placement="bottom-start"
      :width="340"
      :popper-style="{ maxWidth: 'calc(100vw - 24px)', padding: '8px' }"
      :disabled="loading || !threads.length"
    >
      <template #reference>
        <button
          type="button"
          class="current-thread"
          :disabled="loading || !threads.length"
          :aria-expanded="opened"
          aria-label="切换历史对话"
        >
          <Icon icon="lucide:messages-square" />
          <span
            class="thread-title"
            :title="getThreadTitle(activeThread)"
          >{{ loading ? '加载对话…' : getThreadTitle(activeThread) }}</span>
          <span
            class="thread-status"
            :class="`is-${activeStatus}`"
          >{{ statusLabels[activeStatus] || '未知状态' }}</span>
          <Icon
            icon="lucide:chevron-down"
            class="thread-chevron"
          />
        </button>
      </template>
      <div class="history-heading">
        历史对话 <span>{{ threads.length }}</span>
      </div>
      <div
        class="thread-list"
        aria-label="历史对话"
      >
        <div
          v-for="thread in threads"
          :key="thread.threadId"
          class="thread-row"
          :class="{ 'is-active': thread.threadId === modelValue }"
        >
          <button
            type="button"
            class="thread-select"
            :aria-current="thread.threadId === modelValue ? 'true' : undefined"
            @click="activate(thread.threadId)"
          >
            <span
              class="thread-title"
              :title="getThreadTitle(thread)"
            >{{ getThreadTitle(thread) }}</span>
            <span class="thread-meta">
              <time>{{ formatDate(thread.lastActiveAt || thread.createdAt).slice(0, 16) }}</time>
              <span
                class="thread-status"
                :class="`is-${getThreadStatus(thread, conversationStatus)}`"
              >{{ statusLabels[getThreadStatus(thread, conversationStatus)] || '未知状态' }}</span>
            </span>
          </button>
          <button
            v-if="renameable"
            type="button"
            class="thread-action"
            :aria-label="`重命名对话：${getThreadTitle(thread)}`"
            title="重命名对话"
            @click="rename(thread)"
          >
            <Icon icon="lucide:pencil" />
          </button>
          <button
            type="button"
            class="thread-action thread-delete"
            :aria-label="`删除对话：${getThreadTitle(thread)}`"
            title="删除对话"
            @click="confirmDelete(thread)"
          >
            <Icon icon="lucide:trash-2" />
          </button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { confirmAction } from '@/utils/confirmUtils.js'
import { formatDate } from '@/utils/format.js'
import { getThreadStatus, getThreadTitle } from '@/utils/aiRuntime.js'

const props = defineProps({
  modelValue: { type: String, default: null },
  threads: { type: Array, default: () => [] },
  conversationStatus: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  renameable: { type: Boolean, default: false }
})
const emit = defineEmits(['activate', 'delete', 'rename'])
const opened = ref(false)
const activeThread = computed(() => props.threads.find(thread => thread.threadId === props.modelValue))
const activeStatus = computed(() => getThreadStatus(activeThread.value, props.conversationStatus))
const statusLabels = {
  idle: '就绪', queued: '排队中', running: '执行中', cancelling: '停止中',
  waiting_for_user: '待回复', completed: '已完成', failed: '失败', cancelled: '已停止'
}

const activate = threadId => {
  opened.value = false
  emit('activate', threadId)
}

const rename = async thread => {
  opened.value = false
  try {
    const { value } = await ElMessageBox.prompt('输入对话标题', '重命名对话', {
      inputValue: getThreadTitle(thread),
      inputValidator: value => Boolean(value?.trim()) && value.trim().length <= 50 || '请输入 1–50 个字符',
      confirmButtonText: '保存', cancelButtonText: '取消'
    })
    if (props.threads.some(item => item.threadId === thread.threadId)) {
      emit('rename', { threadId: thread.threadId, title: value.trim() })
    }
  } catch { /* 用户取消重命名 */ }
}

const confirmDelete = async thread => {
  opened.value = false
  const confirmed = await confirmAction({
    title: '删除对话',
    message: `删除“${getThreadTitle(thread)}”？对话记录删除后无法恢复。`,
    confirmButtonText: '删除'
  })
  if (confirmed && props.threads.some(item => item.threadId === thread.threadId)) {
    emit('delete', thread.threadId)
  }
}
</script>

<style scoped>
.thread-switcher { flex-shrink: 0; padding: 0 12px 10px; background: var(--ai-muted-surface); }
.current-thread { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; color: var(--el-text-color-secondary); background: var(--el-fill-color-blank); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.current-thread:hover:not(:disabled) { border-color: var(--el-color-primary-light-5); }
.current-thread:disabled { cursor: default; }
.current-thread > .thread-title { flex: 1; }
.current-thread > svg, .thread-chevron { flex-shrink: 0; }
.thread-title { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--el-text-color-primary); font-size: 13px; }
.thread-status { flex-shrink: 0; color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.thread-status.is-running, .thread-status.is-queued { color: var(--el-color-primary); }
.thread-status.is-waiting_for_user, .thread-status.is-cancelling { color: var(--el-color-warning); }
.thread-status.is-failed { color: var(--el-color-danger); }
.thread-status.is-completed { color: var(--el-color-success); }
.history-heading { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 10px; color: var(--el-text-color-secondary); font-size: 12px; }
.thread-list { max-height: min(340px, 60vh); overflow-y: auto; overscroll-behavior: contain; }
.thread-row { display: flex; align-items: center; gap: 4px; padding-right: 4px; border-radius: 6px; }
.thread-row:hover { background: var(--el-fill-color-light); }
.thread-row.is-active { background: var(--el-color-primary-light-9); }
.thread-row.is-active .thread-title { color: var(--el-color-primary); }
.thread-select { flex: 1; min-width: 0; padding: 10px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; }
.thread-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 5px; color: var(--el-text-color-secondary); font-size: 11px; }
.thread-action { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0; border: 0; border-radius: 6px; color: var(--el-text-color-secondary); background: transparent; cursor: pointer; }
.thread-action:hover { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.thread-delete:hover { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.current-thread:focus-visible, .thread-select:focus-visible, .thread-action:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
</style>
