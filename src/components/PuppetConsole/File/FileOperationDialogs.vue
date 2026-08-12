<template>
  <FilePreview ref="filePreviewRef" />
  <FileDownload ref="fileDownloadRef" />
  <FileDelete
    ref="fileDeleteRef"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileCompress
    ref="fileCompressRef"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileDecompress
    ref="fileDecompressRef"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileTransfer
    ref="fileCopyRef"
    mode="copy"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileTransfer
    ref="fileMoveRef"
    mode="move"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileTouch
    ref="fileTouchRef"
    :session-id="sessionId"
  />
  <FileRename
    ref="fileRenameRef"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
  <FileChmod
    ref="fileChmodRef"
    :session-id="sessionId"
    :file="activeFile"
    :disk="disk"
    :current-path="currentPath"
    @refresh="emit('refresh')"
  />
</template>

<script setup>
import { nextTick, ref } from 'vue'
import FilePreview from './FilePreview.vue'
import FileDownload from './FileDownload.vue'
import FileDelete from './FileDelete.vue'
import FileCompress from './FileCompress.vue'
import FileDecompress from './FileDecompress.vue'
import FileTransfer from './FileTransfer.vue'
import FileTouch from './FileTouch.vue'
import FileRename from './FileRename.vue'
import FileChmod from './FileChmod.vue'
import { getFilePreviewMeta, resolveCurrentFileDirectory, resolveFileEntryPath } from './fileTableModel.js'

const props = defineProps({
  sessionId: { type: String, required: true },
  disk: { type: String, default: '' },
  currentPath: { type: String, default: '' },
  absolutePath: { type: String, default: '' }
})
const emit = defineEmits(['refresh'])
const activeFile = ref({})
const filePreviewRef = ref(null)
const fileDownloadRef = ref(null)
const fileDeleteRef = ref(null)
const fileCompressRef = ref(null)
const fileDecompressRef = ref(null)
const fileCopyRef = ref(null)
const fileMoveRef = ref(null)
const fileTouchRef = ref(null)
const fileRenameRef = ref(null)
const fileChmodRef = ref(null)

const dialogRefs = {
  copy: fileCopyRef,
  move: fileMoveRef,
  compress: fileCompressRef,
  decompress: fileDecompressRef,
  delete: fileDeleteRef,
  rename: fileRenameRef,
  chmod: fileChmodRef
}

async function open(action, file) {
  activeFile.value = file || {}
  await nextTick()
  if (action === 'touch') {
    const path = resolveFileEntryPath(file, props)
    fileTouchRef.value?.openDialog(path, Boolean(file?.isDirectory))
    return
  }
  dialogRefs[action]?.value?.openDialog()
}

function preview(path, fileMeta = {}) {
  if (!path) return
  filePreviewRef.value?.preView(props.sessionId, path, fileMeta)
}

function previewEntry(file) {
  const path = resolveFileEntryPath(file, props)
  preview(path, getFilePreviewMeta(file))
}

function download(file) {
  const directory = resolveCurrentFileDirectory(props.disk, props.currentPath)
  const normalizedDirectory = directory.endsWith('/') ? directory : `${directory}/`
  fileDownloadRef.value?.openDialog(
    props.sessionId,
    normalizedDirectory,
    file?.name || '',
    Number(file?.size || 0)
  )
}

defineExpose({ open, preview, previewEntry, download })
</script>
