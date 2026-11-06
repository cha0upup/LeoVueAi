import { describe, expect, it } from 'vitest'
import { createUserMessage } from './aiMessageFactory.js'

describe('createUserMessage', () => {
  it('keeps attachment metadata while allowing an attachment-only display turn', () => {
    const attachments = [{ name: 'pom.xml', mimeType: 'text/xml', size: 1024 }]
    const message = createUserMessage({
      content: '请阅读并分析附件。',
      displayText: '',
      attachments,
      timestamp: 123
    })

    expect(message).toEqual({
      id: null,
      turnId: null,
      role: 'user',
      content: '',
      attachments,
      timestamp: 123
    })
  })
})
