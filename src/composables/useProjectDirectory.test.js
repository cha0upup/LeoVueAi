import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

const mocks = vi.hoisted(() => ({ getProjects: vi.fn() }))

vi.mock('@/services/api/projects.js', () => ({
  getProjectsApi: mocks.getProjects
}))

import {
  ALL_PROJECTS_ID,
  UNASSIGNED_PROJECT_ID,
  useProjectDirectory
} from './useProjectDirectory.js'

describe('useProjectDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProjects.mockResolvedValue({ data: [] })
    const storage = new Map()
    vi.stubGlobal('window', { localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    } })
  })
  afterEach(() => vi.unstubAllGlobals())

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

    mocks.getProjects.mockResolvedValueOnce({ data: [{ projectId: 'legacy-flat' }] })
    expect(await directory.loadProjects()).toBe(true)
    expect(directory.projectsError.value).toBe('项目目录响应格式异常')
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

  it('restores each account’s workspace only after verifying a saved project', async () => {
    const userOne = useProjectDirectory('user-one')
    userOne.selectProject('project-1')
    const userTwo = useProjectDirectory('user-two')
    expect(userTwo.selectedProjectId.value).toBe(ALL_PROJECTS_ID)
    userTwo.selectProject(UNASSIGNED_PROJECT_ID)

    const directory = useProjectDirectory('user-one')
    expect(directory.activeProjectId.value).toBe('')
    mocks.getProjects.mockRejectedValueOnce(new Error('目录暂不可用'))
    await directory.loadProjects()
    expect(directory.selectedProjectId.value).toBe(ALL_PROJECTS_ID)

    mocks.getProjects.mockResolvedValueOnce({ data: [{ project: { projectId: 'project-1' } }] })
    await directory.loadProjects()
    expect(directory.activeProjectId.value).toBe('project-1')
    expect(useProjectDirectory('user-two').selectedProjectId.value).toBe(UNASSIGNED_PROJECT_ID)
  })

  it('forgets a project confirmed missing from the current account’s directory', async () => {
    const directory = useProjectDirectory('user')
    directory.selectProject('missing-project')
    await directory.loadProjects()
    expect(directory.selectedProjectId.value).toBe(ALL_PROJECTS_ID)

    const reopened = useProjectDirectory('user')
    mocks.getProjects.mockResolvedValueOnce({ data: [{ project: { projectId: 'missing-project' } }] })
    await reopened.loadProjects()
    expect(reopened.isAllProjects.value).toBe(true)
  })
})
