import { computed, ref } from 'vue'

import { getProjectsApi } from '@/services/api.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

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

  const loadProjects = async () => {
    projectsLoading.value = true
    try {
      const response = await getProjectsApi()
      projects.value = (response.data || []).map(normalizeProjectSummary)
      if (
        selectedProjectId.value !== UNASSIGNED_PROJECT_ID &&
        selectedProjectId.value !== ALL_PROJECTS_ID &&
        !projects.value.some((project) => project.projectId === selectedProjectId.value)
      ) {
        selectedProjectId.value = ALL_PROJECTS_ID
      }
      return projects.value
    } finally {
      projectsLoading.value = false
    }
  }

  const selectProject = (projectId) => {
    selectedProjectId.value = projectId || ALL_PROJECTS_ID
    safeLocalStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, selectedProjectId.value)
  }

  return {
    projects,
    projectsLoading,
    selectedProjectId,
    activeProject,
    activeProjectId,
    isUnassignedProject,
    isAllProjects,
    loadProjects,
    selectProject
  }
}
