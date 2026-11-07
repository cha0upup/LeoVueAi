import { computed, onScopeDispose, ref, watch } from 'vue'
import { getSkillFileApi, listSkillFilesApi } from '@/services/api/skills.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { showError } from '@/utils/messageUtils.js'

/** File workspace lifecycle. Requests only publish into the workspace that started them. */
export function useSkillWorkspace({ activeScope, uiState, onMetadataChanged }) {
  const selectedSkill = ref(null)
  const selectedSkillName = computed(() => selectedSkill.value?.name || '')
  const skillFiles = ref([])
  const filesLoading = ref(false)
  const currentFilePath = ref('')
  const currentFileContent = ref('')
  const currentFileEncoding = ref('text')
  const currentFileSize = ref(0)
  const fileLoading = ref(false)
  const dirtyFilePaths = ref([])
  const fileEditorRef = ref(null)
  let epoch = 0
  let listRevision = 0
  let fileRevision = 0
  let disposed = false

  const context = () => ({ epoch, scope: activeScope.value, name: selectedSkillName.value })
  const isCurrent = (request) => !disposed && request.epoch === epoch && request.scope === activeScope.value && request.name === selectedSkillName.value

  const clearWorkspace = () => {
    epoch += 1
    listRevision += 1
    fileRevision += 1
    selectedSkill.value = null
    skillFiles.value = []
    currentFilePath.value = ''
    currentFileContent.value = ''
    currentFileEncoding.value = 'text'
    currentFileSize.value = 0
    dirtyFilePaths.value = []
    filesLoading.value = false
    fileLoading.value = false
  }

  const confirmLeaveEdit = async () => !dirtyFilePaths.value.length || confirmAction({
    title: '存在未保存内容',
    message: `有 ${dirtyFilePaths.value.length} 个文件未保存，离开后将丢失修改。`,
    confirmButtonText: '放弃并离开',
    cancelButtonText: '继续编辑'
  })

  const loadSkillFiles = async () => {
    if (!selectedSkillName.value || disposed) return false
    const request = context()
    const revision = ++listRevision
    const current = () => isCurrent(request) && revision === listRevision
    filesLoading.value = true
    try {
      const response = await listSkillFilesApi(request.scope, request.name)
      if (!current()) return false
      skillFiles.value = Array.isArray(response.data) ? response.data : []
      return true
    } catch (error) {
      if (current()) {
        showError(error?.response?.data?.msg || '加载文件列表失败')
        skillFiles.value = []
      }
      return false
    } finally {
      if (current()) filesLoading.value = false
    }
  }

  const openFile = async (path, force = false) => {
    if (!path || !selectedSkillName.value || disposed) return false
    if (!force && path === currentFilePath.value) return true
    const request = context()
    const revision = ++fileRevision
    const current = () => isCurrent(request) && revision === fileRevision
    fileLoading.value = false
    if (fileEditorRef.value?.hasUnsavedChanges?.() && !(await confirmAction({
      title: '存在未保存内容',
      message: '当前文件有未保存修改，切换后将丢失。',
      confirmButtonText: '放弃并切换',
      cancelButtonText: '继续编辑'
    }))) return false
    if (!current()) return false
    fileLoading.value = true
    try {
      const response = await getSkillFileApi(request.scope, request.name, path)
      if (!current()) return false
      const data = response.data || {}
      currentFilePath.value = path
      currentFileContent.value = data.content ?? ''
      currentFileEncoding.value = data.encoding || 'text'
      currentFileSize.value = data.size || 0
      uiState.value = { ...uiState.value, lastFilePath: path }
      return true
    } catch (error) {
      if (current()) showError(error?.response?.data?.msg || '加载文件失败')
      return false
    } finally {
      if (current()) fileLoading.value = false
    }
  }

  const openSkill = async (skill) => {
    if (!skill?.name || disposed) return false
    const sameSkill = skill.name === selectedSkillName.value
    const remembered = sameSkill ? uiState.value.lastFilePath : ''
    clearWorkspace()
    selectedSkill.value = skill
    const request = context()
    const loaded = await loadSkillFiles()
    if (!isCurrent(request)) return false
    // Overview/validation remain available even when the file endpoint is offline.
    if (!loaded) return true
    const exists = (path) => skillFiles.value.some((file) => file.path === path)
    const target = (remembered && exists(remembered) && remembered) ||
      (exists('SKILL.md') && 'SKILL.md') || skillFiles.value[0]?.path || ''
    if (target) await openFile(target)
    return isCurrent(request)
  }

  const reloadFiles = async () => {
    if (!(await loadSkillFiles())) return
    if (currentFilePath.value && !skillFiles.value.some((file) => file.path === currentFilePath.value)) {
      fileRevision += 1
      fileLoading.value = false
      currentFilePath.value = ''
      currentFileContent.value = ''
      currentFileEncoding.value = 'text'
      currentFileSize.value = 0
    }
  }

  const onOpenAfterWrite = async (path) => {
    const request = context()
    await loadSkillFiles()
    if (isCurrent(request)) await openFile(path, true)
  }
  const onFileSaved = async ({ path }) => {
    const request = context()
    dirtyFilePaths.value = dirtyFilePaths.value.filter((item) => item !== path)
    await loadSkillFiles()
    if (isCurrent(request) && (path === 'SKILL.md' || path === 'manifest.yaml')) await onMetadataChanged?.()
  }
  const onDirtyChange = (dirty) => {
    const path = currentFilePath.value
    if (!path) return
    const hasPath = dirtyFilePaths.value.includes(path)
    if (dirty && !hasPath) dirtyFilePaths.value = [...dirtyFilePaths.value, path]
    else if (!dirty && hasPath) dirtyFilePaths.value = dirtyFilePaths.value.filter((item) => item !== path)
  }

  watch(activeScope, clearWorkspace, { flush: 'sync' })
  onScopeDispose(() => { clearWorkspace(); disposed = true })

  return {
    selectedSkill, selectedSkillName, skillFiles, filesLoading, currentFilePath,
    currentFileContent, currentFileEncoding, currentFileSize, fileLoading, dirtyFilePaths, fileEditorRef,
    confirmLeaveEdit, clearWorkspace, openSkill, loadSkillFiles, reloadFiles, openFile,
    onOpenAfterWrite, onFileSaved, onDirtyChange
  }
}
