import { describe, expect, it } from 'vitest'
import { createTerminalOutputDecoder } from './terminalProtocol.js'
import { requireTerminalSuccess } from '../../../services/terminalResponse.js'
import { applyTerminalMetadata, createTerminalSession } from './terminalWorkspaceModel.js'

describe('terminal protocol', () => {
  it('decodes split UTF-8 independently for each session and flushes EOF', () => {
    const first = createTerminalOutputDecoder()
    const second = createTerminalOutputDecoder()
    const bytes = new TextEncoder().encode('中')
    const payload = (data) => ({ data: btoa(String.fromCharCode(...data)) })
    expect(first(payload(bytes.slice(0, 1)))).toBe('')
    expect(second(payload(new TextEncoder().encode('hello')), true)).toBe('hello')
    expect(first(payload(bytes.slice(1)), true)).toBe('中')
    expect(() => first({ data: 'not-base64!' })).toThrow('Base64')
  })

  it('requires a structured response with a numeric status and reports component errors', () => {
    for (const data of ['aGVsbG8=', null, [], {}, { code: '200' }]) {
      expect(() => requireTerminalSuccess(data)).toThrow('响应格式无效')
    }
    expect(requireTerminalSuccess({ code: 200 })).toEqual({ code: 200 })
    expect(() => requireTerminalSuccess({ code: 500, msg: 'offline' })).toThrow('offline')
  })

  it('keeps EOF monotonic when an older write response arrives afterwards', () => {
    const session = createTerminalSession({ id: 'p', hostSessionId: 'h' })
    applyTerminalMetadata(session, { instanceId: 'a', alive: false, exitCode: 7, eof: true }, true)
    applyTerminalMetadata(session, { instanceId: 'a', alive: true })
    expect(session).toMatchObject({
      processExited: true,
      ended: true,
      endReason: '终端进程已结束，退出码 7'
    })
    expect(applyTerminalMetadata(session, { instanceId: 'b', backend: 'other' })).toBe(false)
    expect(session.backend).toBe('detecting')
  })
})
