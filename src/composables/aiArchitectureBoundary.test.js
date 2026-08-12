import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = relativePath =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

describe('AI frontend architecture boundaries', () => {
  it('routes both assistants through the shared chat composable and reducer', () => {
    const assistants = [
      source('components/PlatformAi/PlatformAiAssistant.vue'),
      source('components/PuppetConsole/Ai/PuppetAiAssistant.vue')
    ]

    for (const assistant of assistants) {
      expect(assistant).toContain("from '@/composables/useAiChat.js'")
      expect(assistant).not.toContain('createAiChatEventReducer')
      expect(assistant).not.toContain("services/api/ai-sse")
    }

    const chat = source('composables/useAiChat.js')
    expect(chat).toContain("from './aiChatEventReducer.js'")
    expect(chat).toContain('createAiChatEventReducer({')
  })

  it('keeps raw SSE parsing inside the API adapter layer', () => {
    expect(source('services/api/platform-ai.js'))
      .toContain("import { fetchAiSse } from './ai-sse.js'")
    expect(source('services/api/puppet-ai.js'))
      .toContain("import { fetchAiSse } from './ai-sse.js'")
  })

  it('keeps Turn trace protocol in the shared parser and reducer', () => {
    const parser = source('services/api/ai-sse.js')
    const reducer = source('composables/aiChatEventReducer.js')

    expect(parser).toContain("eventName === 'trace'")
    expect(parser).toContain('onTrace?.(')
    expect(reducer).toContain('trace: {')
    expect(reducer).toContain('traceId:')
    expect(source('services/api/platform-ai.js')).toContain('...handlers')
    expect(source('services/api/puppet-ai.js')).toContain('...handlers')
  })

  it('submits commands separately from the thread event subscription', () => {
    const chat = source('composables/useAiChat.js')
    const platformApi = source('services/api/platform-ai.js')
    const puppetApi = source('services/api/puppet-ai.js')

    expect(chat).toContain('await enqueueApi({')
    expect(chat).toContain('resumeConversationStream({ key })')
    expect(chat).not.toContain('chatApi')
    expect(platformApi).not.toContain('platformAiChat')
    expect(puppetApi).not.toContain('puppetNodeAiChat')
  })
})
