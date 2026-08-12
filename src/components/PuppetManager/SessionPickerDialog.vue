<template>
  <el-dialog
    v-model="visible"
    width="520px"
    class="session-picker-dialog"
    destroy-on-close
    @closed="reset"
  >
    <template #header>
      <div class="session-picker-title">
        <span class="session-picker-title__icon">
          <el-icon><Icon :icon="iconMap.session" /></el-icon>
        </span>
        <span>
          <strong>选择活动会话</strong>
          <small>{{ puppet?.puppetName || '当前主机' }} 已有 {{ sessions.length }} 个活动会话</small>
        </span>
      </div>
    </template>

    <p class="session-picker-hint">
      复用已有会话可以保留当前上下文；需要独立环境时再创建新会话。
    </p>
    <div class="session-picker-list">
      <button
        v-for="session in sortedSessions"
        :key="session.sessionId"
        type="button"
        class="session-picker-item"
        @click="selectSession(session)"
      >
        <span
          class="session-picker-item__state"
          :class="{ cache: session.cacheMode }"
        >
          <i />{{ session.cacheMode ? '缓存' : '实时' }}
        </span>
        <span class="session-picker-item__body">
          <strong>{{ shortSessionId(session.sessionId) }}</strong>
          <small>
            {{ session.projectName || getProjectLabel(session.projectId) }} ·
            最近活动 {{ formatSessionTime(session.lastActiveTime || session.updateTime) }}
          </small>
        </span>
        <el-icon class="session-picker-item__arrow">
          <Icon :icon="iconMap.arrowRight" />
        </el-icon>
      </button>
    </div>

    <template #footer>
      <div class="session-picker-footer">
        <span>现有会话均会继续保持</span>
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          plain
          @click="createSession"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新建会话
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

import { icons } from '@/utils/icons.js'

const props = defineProps({ projects: { type: Array, default: () => [] } })
const emit = defineEmits(['open-session', 'create-session'])
const iconMap = icons
const visible = ref(false)
const puppet = ref(null)
const sessions = ref([])
const sortedSessions = computed(() =>
  sessions.value.slice().sort(
    (a, b) =>
      Number(b.lastActiveTime || b.updateTime || 0) -
      Number(a.lastActiveTime || a.updateTime || 0)
  )
)

const getProjectLabel = (projectId) => {
  if (!projectId) return '未指定项目'
  return props.projects.find((project) => project.projectId === projectId)?.projectName || '项目会话'
}
const shortSessionId = (sessionId) => `会话 ${String(sessionId || '').slice(0, 8)}`
const formatSessionTime = (timestamp) => {
  const time = Number(timestamp)
  if (!time || Number.isNaN(time)) return '未知'
  const delta = Math.max(0, Date.now() - time)
  if (delta < 60000) return '刚刚'
  if (delta < 3600000) return `${Math.floor(delta / 60000)} 分钟前`
  if (delta < 86400000) return `${Math.floor(delta / 3600000)} 小时前`
  return `${Math.floor(delta / 86400000)} 天前`
}

const reset = () => {
  puppet.value = null
  sessions.value = []
}
const open = (row, activeSessions = []) => {
  puppet.value = row
  sessions.value = activeSessions
  visible.value = true
}
const selectSession = (session) => {
  visible.value = false
  emit('open-session', session)
}
const createSession = () => {
  const row = puppet.value
  visible.value = false
  emit('create-session', row)
}

defineExpose({ open })
</script>

<style scoped>
.session-picker-title,
.session-picker-title > span:last-child,
.session-picker-item,
.session-picker-item__body,
.session-picker-footer {
  display: flex;
}

.session-picker-title {
  align-items: center;
  gap: 10px;
}

.session-picker-title__icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.session-picker-title > span:last-child,
.session-picker-item__body {
  flex-direction: column;
}

.session-picker-title strong {
  font-size: 15px;
}

.session-picker-title small,
.session-picker-hint,
.session-picker-item small,
.session-picker-footer span {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.session-picker-hint {
  margin: 0 0 10px;
  line-height: 1.6;
}

.session-picker-list {
  max-height: 330px;
  overflow-y: auto;
}

.session-picker-item {
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 6px;
  border: 1px solid var(--app-divider-color);
  border-radius: 9px;
  background: var(--app-card-background);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}

.session-picker-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 42%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 5%, var(--app-card-background));
}

.session-picker-item__state {
  width: 52px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  color: var(--el-color-success-dark-2);
  font-size: 10px;
  font-weight: 700;
}

.session-picker-item__state.cache {
  color: var(--el-color-warning-dark-2);
}

.session-picker-item__state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.session-picker-item__body {
  min-width: 0;
  flex: 1;
}

.session-picker-item__body strong {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}

.session-picker-item__body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-picker-item__arrow {
  color: var(--el-text-color-placeholder);
}

.session-picker-footer {
  width: 100%;
  align-items: center;
}

.session-picker-footer > span {
  flex: 1;
  text-align: left;
}
</style>
