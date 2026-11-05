import { computed, h, nextTick, onScopeDispose, ref, shallowReactive, watch } from 'vue'
import {
  listSshProfilesApi,
  getSshProfileApi,
  deleteSshProfileApi,
  connectSshTerminalApi,
  execSshTerminalApi
} from '@/services/api/ssh-terminal.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'

const endpoint = (profile) => `${profile.username}@${profile.host}:${profile.port}`
const label = (profile) => profile.name || `${profile.username}@${profile.host}`

/** SSH orchestration only: saved profiles, one-click connections and trust confirmation. */
export function useSshWorkspace({
  hostSessionId,
  pollingConfig = {},
  createProcessId,
  confirm = confirmAction,
  api = {
    list: listSshProfilesApi,
    get: getSshProfileApi,
    delete: deleteSshProfileApi,
    connect: connectSshTerminalApi,
    execute: execSshTerminalApi
  }
}) {
  const attempts = shallowReactive(new Map())
  const pendingIds = computed(() => new Set(attempts.keys()))
  const profiles = ref([]),
    listError = ref(''),
    loading = ref(false),
    deletingIds = ref(new Set())
  let generation = 0,
    listRequest = 0,
    abort
  const current = (epoch, sessionId) => epoch === generation && sessionId === hostSessionId.value
  const present = (params) =>
    terminal.sessions.value.some(
      (session) => session.id === params.processId && session.hostSessionId === params.sessionId
    )
  async function connectWithTrust(params) {
    const epoch = generation
    try {
      return await api.connect(params)
    } catch (error) {
      const details = error?.response?.data
      if (!current(epoch, params.sessionId) || !present(params))
        throw new Error('SSH 连接已取消', { cause: error })
      if (details?.errorCode !== 'SSH_HOST_KEY_CONFIRMATION_REQUIRED') throw error
      if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(details.fingerprint || ''))
        throw new Error('SSH 返回的主机指纹无效', { cause: error })
      const trusted = await confirm({
        title: details.previousFingerprint ? 'SSH 主机指纹发生变化' : '确认 SSH 主机指纹',
        message: h(
          'div',
          {
            style: {
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontFamily: 'var(--font-family-code)',
              fontSize: '12px',
              lineHeight: '1.8'
            }
          },
          `主机：${details.host}:${details.port}\n${details.previousFingerprint ? `原指纹：${details.previousFingerprint}\n` : ''}当前指纹：${details.fingerprint}\n请核对主机指纹后继续。`
        ),
        confirmButtonText: '已核对，连接',
        closeOnClickModal: false
      })
      if (!trusted || !current(epoch, params.sessionId) || !present(params))
        throw new Error('SSH 连接已取消', { cause: error })
      // A further key change is surfaced as a failure, never automatically approved.
      return api.connect({ ...params, fingerprint: details.fingerprint })
    }
  }
  const terminal = useTerminalWorkspace({
    hostSessionId,
    agentTerminalAvailable: ref(false),
    connectSsh: connectWithTrust,
    executeSsh: api.execute,
    pollingConfig,
    createProcessId
  })

  async function refreshProfiles() {
    const epoch = generation,
      sessionId = hostSessionId.value,
      request = ++listRequest
    if (!sessionId) return
    abort?.abort()
    abort = new AbortController()
    loading.value = true
    listError.value = ''
    try {
      const response = await api.list(sessionId, abort.signal)
      if (current(epoch, sessionId) && request === listRequest)
        profiles.value = Array.isArray(response.data) ? response.data : []
    } catch (error) {
      if (current(epoch, sessionId) && request === listRequest)
        listError.value = error.message || '读取 SSH 连接配置失败'
    } finally {
      if (current(epoch, sessionId) && request === listRequest) loading.value = false
    }
  }
  function saved(profile) {
    const index = profiles.value.findIndex((row) => row.profileId === profile.profileId)
    if (index < 0) profiles.value = [profile, ...profiles.value]
    else
      profiles.value = profiles.value.map((row) =>
        row.profileId === profile.profileId ? profile : row
      )
  }
  function existing(profile) {
    return terminal.sessions.value
      .slice()
      .reverse()
      .find(
        (session) =>
          session.profileId === profile.profileId &&
          session.endpoint === endpoint(profile) &&
          !session.ended &&
          !session.processExited
      )
  }
  function openProfile(profile, { forceNew = false, refresh = false, replaceId } = {}) {
    const id = profile.profileId,
      sessionId = hostSessionId.value,
      epoch = generation
    if (!sessionId || !id) return Promise.resolve(null)
    if (attempts.has(id)) {
      const pending = existing(profile)
      if (pending) terminal.activateSession(pending.id)
      return attempts.get(id)
    }
    const live = !forceNew && existing(profile)
    if (live) {
      terminal.activateSession(live.id)
      nextTick(() => {
        if (current(epoch, sessionId) && terminal.activeSessionId.value === live.id)
          terminal.focusActiveViewport()
      })
      return Promise.resolve(live)
    }
    let task
    task = Promise.resolve()
      .then(async () => {
        if (refresh) {
          const response = await api.get(sessionId, id)
          if (!current(epoch, sessionId)) return null
          profile = response.data
          saved(profile)
        }
        if (!current(epoch, sessionId)) return null
        if (replaceId) terminal.removeSession(replaceId)
        const session = await terminal.createSshSession({
          profileId: id,
          version: profile.version,
          host: profile.host,
          port: profile.port,
          username: profile.username,
          name: label(profile)
        })
        if (current(epoch, sessionId)) refreshProfiles()
        return session
      })
      .catch((error) => {
        if (current(epoch, sessionId) && replaceId) {
          const failed = terminal.sessions.value.find((session) => session.id === replaceId)
          if (failed) failed.endReason = error.message || 'SSH 重连失败'
        }
        return null
      })
      .finally(() => {
        if (attempts.get(id) === task) {
          attempts.delete(id)
        }
      })
    attempts.set(id, task)
    return task
  }
  function retrySession(session) {
    return openProfile(
      { profileId: session.profileId },
      { forceNew: true, refresh: true, replaceId: session.id }
    )
  }
  async function deleteProfile(profile) {
    const id = profile.profileId,
      epoch = generation,
      sessionId = hostSessionId.value
    if (deletingIds.value.has(id)) return
    deletingIds.value.add(id)
    try {
      const confirmed = await confirm({
        title: '删除 SSH 连接配置',
        message: `删除“${label(profile)}”及其保存的凭据？已打开的终端不受影响。`,
        confirmButtonText: '删除',
        type: 'warning'
      })
      if (!confirmed || !current(epoch, sessionId)) return
      await api.delete({ sessionId, profileId: id, version: profile.version })
      if (current(epoch, sessionId))
        profiles.value = profiles.value.filter((row) => row.profileId !== id)
    } catch (error) {
      if (current(epoch, sessionId)) listError.value = error.message || '删除 SSH 配置失败'
    } finally {
      if (current(epoch, sessionId)) deletingIds.value.delete(id)
    }
  }
  watch(
    hostSessionId,
    () => {
      generation++
      abort?.abort()
      attempts.clear()
      deletingIds.value.clear()
      profiles.value = []
      listError.value = ''
      loading.value = false
      refreshProfiles()
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    generation++
    abort?.abort()
    attempts.clear()
    deletingIds.value.clear()
  })
  return {
    terminal,
    profiles,
    listError,
    loading,
    pendingIds,
    deletingIds,
    refreshProfiles,
    saved,
    openProfile,
    retrySession,
    deleteProfile,
    existing
  }
}
