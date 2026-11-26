import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

import { getProjectsApi } from '@/services/api/projects.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import { handleError } from '@/utils/errorHandler.js'

export const UNASSIGNED_PROJECT_ID = '__unassigned__'
export const ALL_PROJECTS_ID = '__all__'
const ACTIVE_PROJECT_STORAGE_KEY = 'leovue-active-host-project'

const normalizeProjectSummary = (item) => ({
  ...(item?.project || item || {}),
  hostCount: Number(item?.hostCount) || 0,
  activeSessionCount: Number(item?.activeSessionCount) || 0,
  manageable: Boolean(item?.manageable),
  contentEditable: Boolean(item?.contentEditable)
})

export function useProjectDirectory() {
  const projects = ref([])
  const projectsLoading = ref(false)
  const projectsError = ref('')
  let pendingRequest
  const selectedProjectId = ref(
    safeLocalStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) || ALL_PROJECTS_ID
  )

  const activeProject = computed(
    () => projects.value.find((project) => project.projectId === selectedProjectId.value) || null
  )
  const isUnassignedProject = computed(() => selectedProjectId.value === UNASSIGNED_PROJECT_ID)
  const isAllProjects = computed(() => selectedProjectId.value === ALL_PROJECTS_ID)
  const activeProjectId = computed(() =>
    isUnassignedProject.value || isAllProjects.value ? '' : selectedProjectId.value
  )

  const selectProject = (projectId) => {
    selectedProjectId.value = projectId || ALL_PROJECTS_ID
    safeLocalStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, selectedProjectId.value)
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
      if (focusProjectId && selectionAtStart === selectedProjectId.value
        && projects.value.some((project) => project.projectId === focusProjectId)) {
        selectProject(focusProjectId)
      } else if (
        selectedProjectId.value !== UNASSIGNED_PROJECT_ID &&
        selectedProjectId.value !== ALL_PROJECTS_ID &&
        !projects.value.some((project) => project.projectId === selectedProjectId.value)
      ) {
        selectedProjectId.value = ALL_PROJECTS_ID
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
