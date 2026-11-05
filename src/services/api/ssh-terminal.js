import http from '../http.js'

const base = '/agent-node/terminal/ssh'
export const listSshProfilesApi = (sessionId, signal) =>
  http.post(`${base}/profiles`, { sessionId }, { signal })
export const getSshProfileApi = (sessionId, profileId, signal) =>
  http.post(`${base}/profiles/get`, { sessionId, profileId }, { signal })
export const saveSshProfileApi = (params, signal) =>
  http.post(`${base}/profiles/save`, params, { signal })
export const deleteSshProfileApi = (params, signal) =>
  http.post(`${base}/profiles/delete`, params, { signal })
export const connectSshTerminalApi = (params) => {
  const { sessionId, processId, profileId, version, fingerprint } = params
  return http.post(
    `${base}/profiles/connect`,
    { sessionId, processId, profileId, version, ...(fingerprint ? { fingerprint } : {}) },
    { timeout: 60000 }
  )
}
export const execSshTerminalApi = (params) =>
  http.post(`${base}/command`, params, {
    timeout: params.type === 'read' ? 30000 : 45000
  })
