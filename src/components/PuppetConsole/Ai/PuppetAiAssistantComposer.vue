<template>
  <div class="composer-dock">
    <div class="composer-inner">
      <div class="composer-box">
        <div class="composer-shell">
          <AiAttachmentList
            class="composer-attachments"
            :files="attachments"
            :removable="!waitingForUserInput"
            @remove="removeAttachment"
          />
          <el-input
            ref="inputRef"
            :model-value="modelValue"
            class="composer-input"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 8 }"
            :maxlength="8000"
            :placeholder="waitingForUserInput ? '请先回答上方问题' : '给助理发送消息…'"
            :disabled="sending || waitingForUserInput"
            resize="none"
            @update:model-value="onInput"
            @compositionstart="emit('compositionstart')"
            @compositionend="emit('compositionend')"
            @keydown="onKeydown"
            @blur="onBlur"
          />
          <div class="composer-toolbar">
            <AiComposerControls
              :model-value="configId"
              :reasoning-effort="reasoningEffort"
              :configs="configs"
              :attachments="attachments"
              :disabled="sending || !sessionId || waitingForUserInput"
              @update:model-value="emit('update:configId', $event)"
              @update:reasoning-effort="emit('update:reasoningEffort', $event)"
              @update:attachments="emit('update:attachments', $event)"
            />
          </div>
          <!-- 斜杠快捷菜单 -->
          <Teleport to="body">
            <Transition name="slash-fade">
              <div
                v-if="showSlashMenu && filteredCommands.length"
                class="slash-menu"
                :style="slashMenuStyle"
              >
                <div
                  v-for="(cmd, idx) in filteredCommands"
                  :key="cmd.name"
                  class="slash-item"
                  :class="{ 'slash-item--active': idx === slashActiveIdx }"
                  @mousedown.prevent="applySlashCommand(cmd)"
                >
                  <span class="slash-name">/{{ cmd.name }}</span>
                  <span class="slash-desc">{{ cmd.desc }}</span>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
        <el-button
          class="send-fab"
          :type="sending ? 'warning' : 'primary'"
          :disabled="sending ? false : (!modelValue.trim() && !attachments.length) || !sessionId || waitingForUserInput"
          circle
          :title="sending ? '取消请求' : '发送'"
          :aria-label="sending ? '取消请求' : '发送消息'"
          @click="emit('fab-click')"
        >
          <el-icon class="send-fab-icon">
            <Icon :icon="sending ? iconMap.stop : iconMap.sendArrow" />
          </el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { icons } from '@/utils/icons.js'
import AiComposerControls from '@/components/Ai/AiComposerControls.vue'
import AiAttachmentList from '@/components/Ai/AiAttachmentList.vue'

const iconMap = icons

const props = defineProps({
  modelValue: { type: String, default: '' },
  sending:    { type: Boolean, default: false },
  sessionId:  { type: String, default: '' },
  composing:  { type: Boolean, default: false },
  /** 已发送历史，由父组件维护 */
  history:    { type: Array, default: () => [] },
  configId: { type: [Number, String], default: null },
  reasoningEffort: { type: String, default: 'medium' },
  configs: { type: Array, default: () => [] },
  attachments: { type: Array, default: () => [] },
  waitingForUserInput: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:modelValue',
  'fab-click',
  'submit',
  'compositionstart',
  'compositionend',
  'update:configId',
  'update:reasoningEffort',
  'update:attachments'
])

const removeAttachment = (id) => {
  emit('update:attachments', props.attachments.filter(file => file.id !== id))
}

// ── 斜杠快捷指令 ──────────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { name: 'recon',   desc: '初步侦察并保存摘要',   value: '请对目标做初步侦察：收集 OS 版本、当前用户、中间件类型、Java 版本和关键进程，完成后将关键发现保存到侦察摘要。' },
  { name: 'enum',    desc: '枚举配置文件和凭据',   value: '请枚举目标常见配置文件路径，寻找数据库凭据、API Key 等敏感信息并汇总。' },
  { name: 'scan',    desc: '内网存活和端口扫描',   value: '请先对内网 C 段做主机存活探测，然后对发现的存活主机做常见端口扫描。' },
  { name: 'jvm',     desc: '检查 JVM 内存和线程',  value: '请帮我分析当前 JVM 内存情况（堆、非堆、GC）和线程状态，指出异常或风险。' },
  { name: 'web',     desc: '检查 Web 容器组件',    value: '请获取当前 Web 容器挂载情况，包括 Filter、Servlet、Valve、Listener 等组件列表。' },
  { name: 'report',  desc: '生成操作报告',         value: '请基于当前会话的操作记录和侦察摘要，生成一份操作报告。' },
  { name: 'privesc', desc: '提权路径分析',         value: '请分析当前主机的提权可能性，检查 SUID、sudo 配置、计划任务、服务配置等常见提权路径。' },
]

const inputRef       = ref(null)
const slashQuery     = ref('')
const showSlashMenu  = ref(false)
const slashActiveIdx = ref(0)
const slashMenuStyle = ref({})

const filteredCommands = computed(() => {
  const q = slashQuery.value.toLowerCase()
  return SLASH_COMMANDS.filter(c =>
    c.name.startsWith(q) || c.desc.includes(q)
  )
})

function applySlashCommand(cmd) {
  emit('update:modelValue', cmd.value)
  closeSlashMenu()
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('textarea')
    el?.focus()
  })
}

function closeSlashMenu() {
  showSlashMenu.value = false
  slashQuery.value = ''
  slashActiveIdx.value = 0
}

// 菜单打开期间在捕获阶段监听全局 scroll，任意容器滚动都立即关闭，防止位置漂移
function onAnyScroll() {
  closeSlashMenu()
}

watch(showSlashMenu, (val) => {
  if (val) {
    window.addEventListener('scroll', onAnyScroll, { passive: true, capture: true })
  } else {
    window.removeEventListener('scroll', onAnyScroll, { capture: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onAnyScroll, { capture: true })
})

function updateSlashMenuPosition() {
  const el = inputRef.value?.$el?.querySelector('textarea')
  if (!el) return
  const rect = el.getBoundingClientRect()
  slashMenuStyle.value = {
    position: 'fixed',
    bottom:   `${window.innerHeight - rect.top + 6}px`,
    left:     `${rect.left}px`,
    width:    `${Math.max(rect.width, 280)}px`,
    zIndex:   '9999'
  }
}

// ── 历史消息召回 ───────────────────────────────────────────────────────────
const historyIdx = ref(-1)

// ── 输入处理 ───────────────────────────────────────────────────────────────
function onInput(val) {
  emit('update:modelValue', val)
  historyIdx.value = -1

  if (val.startsWith('/') && !val.includes('\n')) {
    slashQuery.value = val.slice(1)
    showSlashMenu.value = true
    slashActiveIdx.value = 0
    nextTick(updateSlashMenuPosition)
  } else {
    closeSlashMenu()
  }
}

function onBlur() {
  setTimeout(() => { showSlashMenu.value = false }, 150)
}

function onKeydown(e) {
  // ── 斜杠菜单导航 ─────────────────────────────────────────────────
  if (showSlashMenu.value && filteredCommands.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      slashActiveIdx.value = (slashActiveIdx.value + 1) % filteredCommands.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      slashActiveIdx.value = (slashActiveIdx.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
      return
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault()
      applySlashCommand(filteredCommands.value[slashActiveIdx.value])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSlashMenu()
      return
    }
  }

  // ── 历史消息召回（↑ / ↓，仅输入为空时） ────────────────────────
  if (e.key === 'ArrowUp' && !props.modelValue.trim() && !props.composing) {
    e.preventDefault()
    const h = props.history
    if (!h.length) return
    const next = Math.min(historyIdx.value + 1, h.length - 1)
    historyIdx.value = next
    emit('update:modelValue', h[h.length - 1 - next])
    return
  }
  if (e.key === 'ArrowDown' && historyIdx.value >= 0 && !props.composing) {
    e.preventDefault()
    const next = historyIdx.value - 1
    historyIdx.value = next
    emit('update:modelValue', next >= 0 ? props.history[props.history.length - 1 - next] : '')
    return
  }

  // ── Enter 发送 ─────────────────────────────────────────────────
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.isComposing || e.keyCode === 229 || props.composing) return
  e.preventDefault()
  emit('submit')
}
</script>

<style scoped>
.composer-dock {
  flex-shrink: 0;
  container-type: inline-size;
  container-name: ai-composer;
  padding: 12px 10px 16px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--ai-panel-surface, var(--app-surface-background)) 96%, transparent) 18px
  );
}

.composer-inner {
  max-width: var(--thread-max, 48rem);
  margin: 0 auto;
}

.composer-box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 11px 10px 15px;
  border: 0;
  border-radius: 16px;
  background: var(--el-bg-color-overlay, #fff);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  backdrop-filter: none;
}

.composer-shell {
  flex: 1;
  min-width: 0;
}

.composer-toolbar {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
  margin-top: 8px;
}

.composer-attachments { margin-bottom: 10px; }

.composer-input {
  display: block;
}

.composer-input :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  background: transparent;
  color: var(--el-text-color-primary);
  padding: 0 0 6px;
  font-size: 14px;
  line-height: 1.55;
  min-height: 52px !important;
  resize: none;
}

.composer-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

.composer-input :deep(.el-input__count) {
  background: transparent;
  bottom: 2px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.send-fab {
  flex-shrink: 0;
  width: 38px !important;
  height: 38px !important;
  padding: 0 !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}

.send-fab-icon {
  font-size: 16px;
}

@container ai-composer (max-width: 560px) {
  .composer-box {
    gap: 8px;
    padding: 10px 9px 9px 11px;
  }

  .composer-input :deep(.el-textarea__inner) {
    min-height: 46px !important;
  }

  .send-fab {
    width: 36px !important;
    height: 36px !important;
  }
}

@container ai-composer (max-width: 420px) {
  .composer-box {
    gap: 6px;
    padding-right: 7px;
  }

  .send-fab {
    width: 34px !important;
    height: 34px !important;
    border-radius: 10px !important;
  }
}

@media (max-width: 768px) {
  .composer-dock {
    padding: 8px 10px 10px;
  }

  .composer-box {
    padding: 9px 9px 9px 10px;
    border-radius: 12px;
  }

}

/* ── 斜杠菜单 ─────────────────────────────────────────────────────────── */
:global(.slash-menu) {
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 60%, transparent);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}

:global(.slash-item) {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 14px;
  cursor: pointer;
  transition: background 0.12s;
}

:global(.slash-item:hover),
:global(.slash-item--active) {
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}

:global(.slash-name) {
  font-size: 13px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-color-primary);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 72px;
}

:global(.slash-desc) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.slash-fade-enter-active),
:global(.slash-fade-leave-active) {
  transition: opacity 0.12s, transform 0.12s;
}

:global(.slash-fade-enter-from),
:global(.slash-fade-leave-to) {
  opacity: 0;
  transform: translateY(4px);
}
</style>
