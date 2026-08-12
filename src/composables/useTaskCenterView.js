import { computed, watch } from 'vue'

const clampTaskProgress = (progress) => {
  const value = Number(progress || 0)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

const getSortTime = (task) => {
  const value = task?.endTime || task?.startTime || task?.createdTime
  if (!value) return 0
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const sortTasks = (a, b, mode) => {
  if (mode === 'progress') return clampTaskProgress(b?.progress) - clampTaskProgress(a?.progress)
  if (mode === 'name') {
    return String(a?.fileName || '').localeCompare(String(b?.fileName || ''), 'zh-Hans-CN')
  }

  const timeA = getSortTime(a)
  const timeB = getSortTime(b)
  return mode === 'oldest' ? timeA - timeB : timeB - timeA
}

const taskMatchesKeyword = (task, keyword) => {
  if (!keyword) return true
  const searchFields = [
    task.fileName,
    task.databaseName,
    task.currentTable,
    task.downloadPath,
    task.serverTaskId,
    task.taskId,
    task.command,
    task.backendTaskId,
    task.scanKind,
    task.targetLabel,
    task.scanHost,
    task.scanHosts,
    task.openPortList,
    task.reachableHostList,
    task.unreachableHostList,
    task.fingerprintId,
    task.protocol,
    task.resultSummary
  ]
  return searchFields.some((field) =>
    String(field || '')
      .toLowerCase()
      .includes(keyword)
  )
}

export function useTaskCenterView({
  tasks,
  activeTaskType,
  statusFilter,
  searchKeyword,
  sortOption,
  selectedTaskId,
  activeStatuses
}) {
  const activeStatusSet = computed(() => new Set(activeStatuses?.value || activeStatuses || []))

  const activeTypeTasks = computed(() => {
    return (tasks.value || []).filter((task) => task.type === activeTaskType.value)
  })

  const isActiveStatus = (task) => activeStatusSet.value.has(task?.status)

  const matchesStatus = (task, filter) => {
    if (filter === 'all') return true
    if (filter === 'active') return isActiveStatus(task)
    return task.status === filter
  }

  const filteredTasks = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()

    return [...activeTypeTasks.value]
      .filter((task) => matchesStatus(task, statusFilter.value))
      .filter((task) => taskMatchesKeyword(task, keyword))
      .sort((a, b) => sortTasks(a, b, sortOption.value))
  })

  const selectedTask = computed(() => {
    return filteredTasks.value.find((task) => task.viewId === selectedTaskId.value) || null
  })

  watch(
    filteredTasks,
    (nextTasks) => {
      if (!nextTasks.length) {
        selectedTaskId.value = ''
        return
      }

      const exists = nextTasks.some((task) => task.viewId === selectedTaskId.value)
      if (!exists) {
        selectedTaskId.value = nextTasks[0].viewId
      }
    },
    { immediate: true }
  )

  const countTasksByType = (type) => {
    return (tasks.value || []).filter((task) => task.type === type).length
  }

  return {
    activeTypeTasks,
    filteredTasks,
    selectedTask,
    countTasksByType,
    isActiveStatus,
    setActiveTaskType: (value) => {
      activeTaskType.value = value
    },
    setStatusFilter: (value) => {
      statusFilter.value = value
    },
    setSearchKeyword: (value) => {
      searchKeyword.value = value
    },
    setSortOption: (value) => {
      sortOption.value = value
    },
    selectTask: (viewId) => {
      selectedTaskId.value = viewId
    },
    clampProgress: clampTaskProgress
  }
}
