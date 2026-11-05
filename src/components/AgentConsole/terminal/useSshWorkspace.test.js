import { effectScope, nextTick, ref, watchEffect } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { testTerminalTransport } from './test-support/terminalTransport.js'
vi.mock('@/services/api/ssh-terminal.js', () => ({
  listSshProfilesApi: vi.fn(),
  getSshProfileApi: vi.fn(),
  deleteSshProfileApi: vi.fn(),
  connectSshTerminalApi: vi.fn(),
  execSshTerminalApi: vi.fn()
}))
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction: vi.fn() }))
import { useSshWorkspace } from './useSshWorkspace.js'

const profile = {
  profileId: 'saved-a',
  version: 1,
  name: 'Build',
  host: 'build.internal',
  port: 22,
  username: 'ops'
}
const pin = 'SHA256:' + 'A'.repeat(43)
const trustError = (previousFingerprint = '') => ({
  response: {
    data: {
      errorCode: 'SSH_HOST_KEY_CONFIRMATION_REQUIRED',
      fingerprint: pin,
      previousFingerprint,
      host: profile.host,
      port: profile.port
    }
  }
})
const scopes = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
})
async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve()
  await nextTick()
}
function setup() {
  const scope = effectScope()
  scopes.push(scope)
  const hostSessionId = ref('parent')
  const wire = vi.fn(async () => ({
    data: { alive: true, pty: true, backend: 'ssh', resizable: true }
  }))
  const api = {
    list: vi.fn(async () => ({ data: [{ ...profile }] })),
    get: vi.fn(async () => ({ data: { ...profile, version: 2 } })),
    delete: vi.fn(async () => ({})),
    connect: vi.fn(async () => ({ data: { profileSaved: true } })),
    execute: testTerminalTransport(wire)
  }
  const confirm = vi.fn(async () => true)
  let id = 0
  const model = scope.run(() =>
    useSshWorkspace({
      hostSessionId,
      api,
      confirm,
      createProcessId: () => 'process-' + ++id,
      pollingConfig: { interval: 60000 }
    })
  )
  return { model, api, wire, confirm, scope, hostSessionId }
}
describe('saved SSH workspace lifecycle', () => {
  it('lists metadata without automatically opening a terminal, and connects in one request', async () => {
    const { model, api } = setup()
    await flush()
    expect(model.terminal.sessions.value).toEqual([])
    expect(api.connect).not.toHaveBeenCalled()
    const session = await model.openProfile(profile)
    expect(session).toMatchObject({
      profileId: profile.profileId,
      endpoint: 'ops@build.internal:22',
      viewportReady: true
    })
    expect(api.connect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        profileId: profile.profileId,
        version: 1,
        sessionId: 'parent',
        processId: session.id
      })
    )
    expect(api.connect.mock.calls[0][0]).not.toHaveProperty('fingerprint')
    expect(api.connect.mock.calls[0][0]).not.toHaveProperty('password')
  })
  it('coalesces rapid clicks, activates a live tab and only explicitly opens another session', async () => {
    const { model, api } = setup(),
      pending = deferred()
    api.connect.mockReturnValueOnce(pending.promise)
    const first = model.openProfile(profile),
      second = model.openProfile(profile)
    expect(first).toBe(second)
    await flush()
    expect(model.pendingIds.value.has(profile.profileId)).toBe(true)
    expect(model.terminal.sessions.value).toHaveLength(1)
    pending.resolve({ data: {} })
    const session = await first
    await model.openProfile(profile)
    expect(model.terminal.activeSessionId.value).toBe(session.id)
    expect(api.connect).toHaveBeenCalledTimes(1)
    await model.openProfile(profile, { forceNew: true })
    expect(model.terminal.sessions.value).toHaveLength(2)
    expect(api.connect).toHaveBeenCalledTimes(2)
    expect(model.pendingIds.value.size).toBe(0)
  })
  it('does not activate a live session pointing to a previously edited endpoint', async () => {
    const { model, api } = setup()
    await model.openProfile(profile)
    const next = await model.openProfile({ ...profile, host: 'other.internal', version: 2 })
    expect(next.endpoint).toBe('ops@other.internal:22')
    expect(api.connect).toHaveBeenCalledTimes(2)
  })
  it.each(['', 'SHA256:' + 'B'.repeat(43)])(
    'requires explicit trust on first or changed key (%s)',
    async (previous) => {
      const { model, api, confirm } = setup()
      api.connect.mockRejectedValueOnce(trustError(previous))
      await model.openProfile(profile)
      expect(confirm).toHaveBeenCalledOnce()
      expect(confirm.mock.calls[0][0].title).toBe(
        previous ? 'SSH 主机指纹发生变化' : '确认 SSH 主机指纹'
      )
      expect(api.connect).toHaveBeenCalledTimes(2)
      expect(api.connect.mock.calls[1][0].fingerprint).toBe(pin)
    }
  )
  it('retains a failed tab and retries against the latest saved version', async () => {
    const { model, api } = setup()
    api.connect.mockRejectedValueOnce(new Error('认证失败'))
    await model.openProfile(profile)
    const failed = model.terminal.activeSession.value
    expect(failed).toMatchObject({
      ended: true,
      endReason: expect.stringContaining('认证失败'),
      profileId: profile.profileId
    })
    await model.retrySession(failed)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('parent', profile.profileId)
    expect(api.connect.mock.calls[1][0].version).toBe(2)
    expect(model.terminal.sessions.value).toHaveLength(1)
    expect(model.terminal.activeSession.value.ended).toBe(false)
  })
  it('cancels trust without authenticating and never approves a second key change automatically', async () => {
    const { model, api, confirm } = setup()
    api.connect.mockRejectedValue(trustError())
    confirm.mockResolvedValueOnce(false)
    await model.openProfile(profile)
    expect(api.connect).toHaveBeenCalledTimes(1)
    expect(model.terminal.activeSession.value.ended).toBe(true)
    await model.retrySession(model.terminal.activeSession.value)
    expect(api.connect).toHaveBeenCalledTimes(3)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(model.terminal.activeSession.value.ended).toBe(true)
  })
  it.each(['switch', 'dispose'])(
    'ignores trust confirmation after closing its pending tab and %s',
    async (transition) => {
      const { model, api, confirm, hostSessionId, scope } = setup(),
        pending = deferred()
      api.connect.mockRejectedValue(trustError())
      confirm.mockReturnValue(pending.promise)
      const attempt = model.openProfile(profile)
      await flush()
      model.terminal.removeSession(model.terminal.activeSessionId.value)
      if (transition === 'switch') hostSessionId.value = 'other'
      else scope.stop()
      await nextTick()
      expect(model.pendingIds.value.size).toBe(0)
      pending.resolve(true)
      await attempt
      expect(api.connect).toHaveBeenCalledTimes(1)
      expect(model.terminal.sessions.value).toEqual([])
      expect(model.pendingIds.value.size).toBe(0)
    }
  )
  it('deletes saved credentials independently of already connected terminal sessions', async () => {
    const { model, api, wire, scope } = setup(),
      pending = deferred(),
      deleting = []
    await model.openProfile(profile)
    scope.run(() =>
      watchEffect(() => deleting.push(model.deletingIds.value.has(profile.profileId)))
    )
    api.delete.mockReturnValueOnce(pending.promise)
    const removal = model.deleteProfile(profile)
    await flush()
    await model.deleteProfile(profile)
    expect(model.deletingIds.value.has(profile.profileId)).toBe(true)
    pending.resolve({})
    await removal
    await flush()
    expect(deleting).toEqual([false, true, false])
    expect(model.deletingIds.value.size).toBe(0)
    expect(api.delete).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'parent',
      profileId: profile.profileId,
      version: 1
    })
    expect(model.profiles.value).toEqual([])
    expect(model.terminal.sessions.value).toHaveLength(1)
    expect(wire.mock.calls.some(([p]) => p.type === 'stop')).toBe(false)
  })
  it('discards stale list responses after an Agent change', async () => {
    const { model, api, hostSessionId } = setup(),
      pending = deferred()
    await flush()
    api.list.mockReturnValueOnce(pending.promise)
    const request = model.refreshProfiles()
    hostSessionId.value = 'other'
    await flush()
    pending.resolve({ data: [{ profileId: 'stale' }] })
    await request
    expect(model.profiles.value[0].profileId).toBe(profile.profileId)
  })
})
