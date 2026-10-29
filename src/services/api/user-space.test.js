import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../http.js', () => ({ default: mocks }))

import * as userSpace from './user-space.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('artifact library API contract', () => {
  it('exports the seven APIs consumed by the artifact library', () => {
    expect(Object.keys(userSpace).sort()).toEqual([
      'archiveUserArtifactApi',
      'userFileDeleteApi',
      'userFileDownloadApi',
      'userFileListApi',
      'userFilePreviewApi',
      'userFileUploadApi',
      'userWorkspaceOverviewApi'
    ])
  })

  it('preserves listing, overview and archive requests', () => {
    const filter = { category: 'imports', page: 2 }
    const artifact = { filename: 'report.md', content: 'fixture report' }

    userSpace.userFileListApi(filter)
    userSpace.userWorkspaceOverviewApi()
    userSpace.archiveUserArtifactApi(artifact)

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/platform/user/file/list', { params: filter })
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/platform/user/file/overview')
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/platform/user/file/archive', artifact)
  })

  it('preserves preview, download and delete requests', () => {
    const params = { path: 'imports/fixture.txt' }

    userSpace.userFilePreviewApi(params)
    userSpace.userFileDownloadApi(params)
    userSpace.userFileDeleteApi(params)

    expect(mocks.get).toHaveBeenNthCalledWith(1, '/platform/user/file/preview', { params })
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/platform/user/file/download', {
      params,
      responseType: 'blob'
    })
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/platform/user/file/delete', null, { params })
  })

  it('preserves multipart upload fields and overwrite behavior', () => {
    const file = new File(['fixture'], 'original.txt')

    userSpace.userFileUploadApi(file, {
      path: 'imports',
      filename: 'renamed.txt',
      overwrite: true
    })

    const [url, body, config] = mocks.post.mock.calls[0]
    expect(url).toBe('/platform/user/file/upload')
    expect(body.get('file').name).toBe('original.txt')
    expect(body.get('path')).toBe('imports')
    expect(body.get('filename')).toBe('renamed.txt')
    expect(body.get('overwrite')).toBe('true')
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })
})
