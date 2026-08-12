import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getProjects: vi.fn() }))

vi.mock('@/services/api.js', () => ({ getProjectsApi: mocks.getProjects }))

import {
  ALL_PROJECTS_ID,
  useProjectDirectory
} from './useProjectDirectory.js'

describe('useProjectDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProjects.mockResolvedValue({ data: [] })
  })

  it('normalizes project summary counters and resolves the active project', async () => {
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
  })

  it('falls back to all assets when a saved project disappears', async () => {
    const directory = useProjectDirectory()
    directory.selectProject('missing-project')

    await directory.loadProjects()

    expect(directory.selectedProjectId.value).toBe(ALL_PROJECTS_ID)
    expect(directory.isAllProjects.value).toBe(true)
  })
})
