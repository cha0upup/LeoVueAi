import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

import { getProjectsApi } from '@/services/api/projects.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import { handleError } from '@/utils/errorHandler.js'

export const UNASSIGNED_PROJECT_ID = '__unassigned__'
export const ALL_PROJECTS_ID = '__all__'
const ACTIVE_PROJECT_STORAGE_KEY = 'leovue-active-host-project'

function normalizeProjectSummary(item) {
  const project = item?.project
  if (typeof project?.projectId !== 'string' || !project.projectId.trim()) {
    throw new Error('项目目录响应格式异常')
  }
  return {
    ...project,
    entryNodeCount: Number(item.entryNodeCount) || 0,
    activeSessionCount: Number(item.activeSessionCount) || 0,
    cacheSessionCount: Number(item.cacheSessionCount) || 0,
    manageable: Boolean(item.manageable),
    contentEditable: Boolean(item.contentEditable)
  }
}

export function useProjectDirectory(userId) {
  const projects = ref([])
  const projectsLoading = ref(false)
  const projectsError = ref('')
  let pendingRequest
  const storageKey = userId ? `${ACTIVE_PROJECT_STORAGE_KEY}:${userId}` : null
  const savedProjectId = storageKey ? safeLocalStorage.getItem(storageKey) : null
  const selectedProjectId = ref(savedProjectId === UNASSIGNED_PROJECT_ID ? UNASSIGNED_PROJECT_ID : ALL_PROJECTS_ID)
  // 具体项目等当前账号的目录校验通过后再恢复。
  let projectToRestore = savedProjectId && savedProjectId !== selectedProjectId.value ? savedProjectId : null

  const activeProject = computed(
    () => projects.value.find((project) => project.projectId === selectedProjectId.value) || null
  )
  const isUnassignedProject = computed(() => selectedProjectId.value === UNASSIGNED_PROJECT_ID)
  const isAllProjects = computed(() => selectedProjectId.value === ALL_PROJECTS_ID)
  const activeProjectId = computed(() =>
    isUnassignedProject.value || isAllProjects.value ? '' : selectedProjectId.value
  )

  const selectProject = (projectId) => {
    projectToRestore = null
    selectedProjectId.value = projectId || ALL_PROJECTS_ID
    if (storageKey) safeLocalStorage.setItem(storageKey, selectedProjectId.value)
  }

  // A failed current read can still use the existing workspace; a superseded read must do nothing.
  const loadProjects = async ({ focusProjectId } = {}) => {
    pendingRequest?.abort()
    const request = new AbortController()
    pendingRequest = request
    const { signal } = request
    const selectionAtStart = selectedProjectId.value
    projectsLoading.value = true
    projectsError.value = ''
    try {
      const { data } = await getProjectsApi({ signal })
      if (signal.aborted) return false
      if (!Array.isArray(data)) throw new Error('项目目录响应格式异常')
      projects.value = data.map(normalizeProjectSummary)
      const hasProject = (id) => projects.value.some((project) => project.projectId === id)
      let nextProjectId = projectToRestore || selectedProjectId.value
      if (focusProjectId && selectionAtStart === selectedProjectId.value && hasProject(focusProjectId)) {
        nextProjectId = focusProjectId
      }
      if (nextProjectId !== UNASSIGNED_PROJECT_ID && nextProjectId !== ALL_PROJECTS_ID && !hasProject(nextProjectId)) {
        nextProjectId = ALL_PROJECTS_ID
      }
      if (projectToRestore || nextProjectId !== selectedProjectId.value) {
        selectProject(nextProjectId)
      }
    } catch (error) {
      if (signal.aborted || error?.code === 'SESSION_CHANGED' || error?.response?.status === 401) return false
      projectsError.value = handleError(error, { defaultMessage: '请稍后重试', showMessage: false })
    } finally {
      if (pendingRequest === request) {
        pendingRequest = undefined
        projectsLoading.value = false
      }
    }
    return true
  }

  if (getCurrentScope()) onScopeDispose(() => pendingRequest?.abort())

  return {
    projects,
    projectsLoading,
    projectsError,
    selectedProjectId,
    activeProject,
    activeProjectId,
    isUnassignedProject,
    isAllProjects,
    loadProjects,
    selectProject
  }
}
