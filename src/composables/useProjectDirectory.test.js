import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

const mocks = vi.hoisted(() => ({ getProjects: vi.fn() }))

vi.mock('@/services/api/projects.js', () => ({
  getProjectsApi: mocks.getProjects
}))

import {
  ALL_PROJECTS_ID,
  useProjectDirectory
} from './useProjectDirectory.js'

describe('useProjectDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProjects.mockResolvedValue({ data: [] })
  })

  it('normalizes project summaries and preserves the current workspace when a refresh fails', async () => {
    mocks.getProjects.mockResolvedValue({
      data: [{
        project: { projectId: 'project-1', projectName: 'Alpha', status: 'active' },
        hostCount: 4,
        activeSessionCount: 2,
        manageable: true,
        contentEditable: true
      }]
    })
    const directory = useProjectDirectory()

    await directory.loadProjects()
    directory.selectProject('project-1')

    expect(directory.activeProject.value).toEqual(expect.objectContaining({
      projectName: 'Alpha', hostCount: 4, activeSessionCount: 2, manageable: true,
      contentEditable: true
    }))
    expect(directory.activeProjectId.value).toBe('project-1')

    mocks.getProjects.mockRejectedValueOnce(new Error('目录暂不可用'))
    expect(await directory.loadProjects()).toBe(true)
    expect(directory.projectsError.value).toBe('目录暂不可用')
    expect(directory.projectsLoading.value).toBe(false)
    expect(directory.activeProject.value.projectId).toBe('project-1')
  })

  it('ignores a superseded directory response and its requested selection', async () => {
    const slow = deferred()
    mocks.getProjects.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({
      data: [{ project: { projectId: 'current', status: 'archived' } }]
    })
    const directory = useProjectDirectory()
    const previous = directory.loadProjects({ focusProjectId: 'old' })
    expect(await directory.loadProjects({ focusProjectId: 'current' })).toBe(true)
    expect(mocks.getProjects.mock.calls[0][0].signal.aborted).toBe(true)

    slow.resolve({ data: [{ project: { projectId: 'old', status: 'active' } }] })
    expect(await previous).toBe(false)
    expect(directory.projects.value.map(({ projectId }) => projectId)).toEqual(['current'])
    expect(directory.activeProject.value.status).toBe('archived')
    expect(directory.projectsLoading.value).toBe(false)
  })

  it('falls back to all assets when a saved project disappears', async () => {
    const directory = useProjectDirectory()
    directory.selectProject('missing-project')

    await directory.loadProjects()

    expect(directory.selectedProjectId.value).toBe(ALL_PROJECTS_ID)
    expect(directory.isAllProjects.value).toBe(true)
  })
})
