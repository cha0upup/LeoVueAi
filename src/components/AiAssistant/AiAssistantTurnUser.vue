<template>
  <section class="turn turn-user">
    <div class="turn-inner">
      <div class="user-bubble">
        <p
          v-if="content"
          class="user-text"
        >
          {{ content }}
        </p>
        <AiAttachmentList
          v-if="attachments.length"
          class="user-attachments"
          :files="attachments"
          variant="message"
        />
      </div>
      <div class="user-meta">
        <span class="user-time">{{ formatTurnClock(timestamp) }}</span>
        <button
          type="button"
          class="user-meta-btn"
          title="复制消息"
          aria-label="复制消息"
          @click="copyText"
        >
          <Icon :icon="iconMap.copy" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
import { formatTurnClock } from '@/utils/ai.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import AiAttachmentList from '@/components/Ai/AiAttachmentList.vue'

const iconMap = icons

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    default: null
  },
  attachments: { type: Array, default: () => [] }
})

const copyText = async () => {
  try {
    const attachmentNames = props.attachments.map(file => file.name).filter(Boolean)
    const text = [props.content, attachmentNames.length ? `附件：${attachmentNames.join('、')}` : '']
      .filter(Boolean)
      .join('\n')
    await navigator.clipboard.writeText(text)
    showSuccess('已复制消息')
  } catch {
    showError('复制失败')
  }
}
</script>

<style scoped>
.turn {
  width: 100%;
}

.turn-user {
  background: transparent;
}

.turn-inner {
  max-width: var(--thread-max, 48rem);
  margin: 0 auto;
  padding: 10px 10px 8px;
}

.user-bubble {
  margin-left: auto;
  width: fit-content;
  min-width: min(260px, 100%);
  max-width: min(100%, 60%);
  padding: 12px 14px;
  border-radius: 16px 16px 5px 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent-soft, #2463eb) 10%, var(--turn-user-surface-top)),
    color-mix(in srgb, var(--accent-soft, #2463eb) 7%, var(--turn-user-surface-bottom))
  );
  color: var(--el-text-color-primary);
  border: 0;
  --turn-user-surface-top: var(--el-bg-color-page);
  --turn-user-surface-bottom: var(--el-bg-color-overlay);
}

:global(html.dark .user-bubble),
:global(html[data-theme='dark'] .user-bubble) {
  --turn-user-surface-top: color-mix(
    in srgb,
    var(--app-control-background-soft) 84%,
    var(--el-bg-color-overlay)
  );
  --turn-user-surface-bottom: color-mix(
    in srgb,
    var(--app-control-background) 90%,
    var(--el-bg-color-overlay)
  );
}

.user-meta {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.user-time {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.user-meta-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
}

.user-meta-btn:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
}

.user-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.55;
}

.user-attachments {
  margin-top: 0;
}

.user-text + .user-attachments {
  margin-top: 10px;
  padding-top: 10px;
}

@media (max-width: 768px) {
  .turn-inner {
    padding: 10px 10px 8px;
  }

  .user-bubble {
    max-width: 88%;
    padding: 10px 12px;
    border-radius: 12px;
  }
}
</style>
