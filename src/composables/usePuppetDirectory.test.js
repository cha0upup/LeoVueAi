import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { usePuppetDirectory } from './usePuppetDirectory.js'

const createDirectory = ({ keyword = '', prioritizeOnline = false } = {}) => {
  const allPuppet = ref([
    {
      puppetId: 'host-a',
      puppetName: 'alpha',
      connLink: 'http://alpha.test',
      updateTime: '2026-07-01T00:00:00Z'
    },
    {
      puppetId: 'host-b',
      puppetName: 'beta',
      connLink: 'http://beta.test',
      updateTime: '2026-07-12T00:00:00Z'
    }
  ])
  const searchKeyword = ref(keyword)
  const sortMode = ref('updateTime')
  const prioritizeOnlineNodes = ref(prioritizeOnline)
  const connectionTestResults = ref({})
  const sessionsByPuppetId = ref({
    'host-a': [{ sessionId: 'live-session-123' }]
  })

  return usePuppetDirectory({
    allPuppet,
    searchKeyword,
    sortMode,
    prioritizeOnlineNodes,
    connectionTestResults,
    sessionsByPuppetId
  })
}

describe('usePuppetDirectory live-session integration', () => {
  it('finds a host by a mounted session id', () => {
    const { filteredPuppets } = createDirectory({ keyword: 'session-123' })

    expect(filteredPuppets.value.map((item) => item.puppetId)).toEqual(['host-a'])
  })

  it('prioritizes hosts with live sessions when online sorting is enabled', () => {
    const { filteredPuppets } = createDirectory({ prioritizeOnline: true })

    expect(filteredPuppets.value.map((item) => item.puppetId)).toEqual(['host-a', 'host-b'])
  })
})
