import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useAiChat } from '@/composables/ai/useAiChat.js'
import { useAiHistory } from '@/composables/ai/useAiHistory.js'
import * as historyModel from '@/composables/ai/aiHistoryModel.js'
import * as aiRuntime from '@/utils/aiRuntime.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { createLogger } from '@/utils/logger.js'
import { icons } from '@/utils/icons.js'

it.each([true, false])('opens the selected thread without reloading the list (empty: %s)', async empty => {
  const created = { threadId: 'initial', title: '平台 AI', configId: 7 }
  const existing = { threadId: 'existing', title: '已有对话', configId: 7 }
  const selected = empty ? created : existing
  const initialize = vi.fn().mockResolvedValue({ data: created })
  const list = vi.fn().mockResolvedValue({ data: [selected] })
    .mockResolvedValueOnce({ data: empty ? [] : [existing] })
  const activate = vi.fn().mockResolvedValue({})
  const messages = vi.fn().mockResolvedValue({ data: { messages: [], hasMore: false } })
  const child = name => ({ default: createSlotStub(name) })
  const Assistant = compileClientComponent(new URL('./PlatformAiAssistant.vue', import.meta.url), {
    '@/utils/icons.js': { icons },
    '@/utils/aiRuntime.js': aiRuntime,
    '@/utils/logger.js': { createLogger },
    '@/utils/latestRequestGuard.js': { createLatestRequestGuard },
    '@/utils/messageUtils.js': { showError: vi.fn() },
    '@/services/api/platform-ai.js': {
      platformAiThreadInitializeApi: initialize,
      platformAiThreadsApi: list,
      platformAiThreadActivateApi: activate,
      platformAiMessagesApi: messages
    },
    '@/composables/useAuth.js': { useAuth: () => ({ fetchAuth: vi.fn().mockResolvedValue(null) }) },
    '@/composables/ai/useAiChannelSelector.js': { useAiChannelSelector: () => ({
      configs: ref([{ id: 7 }]), selectedConfigId: ref(7), reasoningEffort: ref('auto'),
      fetchConfigs: vi.fn().mockResolvedValue(null)
    }) },
    '@/composables/ai/useAiChat.js': { useAiChat },
    '@/composables/ai/useAiHistory.js': { useAiHistory },
    '@/composables/ai/aiHistoryModel.js': historyModel,
    './PlatformAiWelcome.vue': child('PlatformAiWelcome'),
    './PlatformAiComposer.vue': child('PlatformAiComposer'),
    '@/components/Ai/AiThreadSwitcher.vue': child('AiThreadSwitcher'),
    '@/components/AiAssistant/AiAssistantTurnUser.vue': child('AiAssistantTurnUser'),
    '@/components/AiAssistant/AiAssistantTurnAssistant.vue': child('AiAssistantTurnAssistant'),
    '@/components/AiAssistant/PlanPopover.vue': child('PlanPopover')
  })
  const renderer = createTestRenderer()
  const app = renderer.createApp(Assistant)
  for (const name of ['Icon', 'ElIcon', 'ElTooltip', 'ElScrollbar', 'ElButton']) app.component(name, createSlotStub(name))
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), setInterval: vi.fn() })
  app.mount(renderer.root)
  try {
    await vi.waitFor(() => expect(findNode(renderer.root, 'PlatformAiComposer').props.ready).toBe(true))
    expect(list).toHaveBeenCalledOnce()
    if (empty) expect(initialize).toHaveBeenCalledExactlyOnceWith({ configId: 7 })
    else expect(initialize).not.toHaveBeenCalled()
    expect(activate).toHaveBeenCalledExactlyOnceWith({ threadId: selected.threadId })
    expect(messages).toHaveBeenCalledExactlyOnceWith({ threadId: selected.threadId, offset: 0, limit: 50 })
    expect(findNode(renderer.root, 'AiThreadSwitcher').props['model-value']).toBe(selected.threadId)
  } finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
