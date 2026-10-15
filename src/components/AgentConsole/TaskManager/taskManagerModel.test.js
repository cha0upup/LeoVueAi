import { describe, expect, it } from 'vitest'
import { TaskStatus, TaskType } from '@/constants/task.js'
import {
  buildTaskList,
  getDownloadRelativePath,
  getIndicatorStatus,
  getPrimaryTaskAction,
  getSecondaryTaskActions,
  normalizeServerDownloadTask,
  normalizeServerSqlExportTask
} from './taskManagerModel.js'

const icons = {
  play: 'play',
  videoPause: 'pause',
  download: 'download',
  circleClose: 'stop',
  delete: 'delete'
}

describe('taskManagerModel', () => {
  it.each([true, false])(
    'disables upload cancellation during commit (local=%s)',
    (isManagedLocally) => {
      const task = {
        type: TaskType.UPLOAD,
        status: TaskStatus.UPLOADING,
        currentStage: 'COMMITTING',
        serverTaskId: 'u1',
        isManagedLocally
      }
      expect(getPrimaryTaskAction(task, icons)).toBeNull()
      expect(getSecondaryTaskActions(task, icons).some((action) => action.key === 'stop')).toBe(
        false
      )
    }
  )
  it('keeps a fully transferred download running until the server commits it', () => {
    const download = normalizeServerDownloadTask(
      {
        taskId: 'd1',
        sessionId: 's1',
        state: 'RUNNING',
        expectedLength: '10',
        downloadedBytes: '10',
        downloadPath: 'downloads/a.txt'
      }
    )
    expect(download).toMatchObject({
      serverTaskId: 'd1',
      sessionId: 's1',
      status: TaskStatus.DOWNLOADING,
      progress: 100,
      fileName: 'a.txt'
    })
    expect(getDownloadRelativePath('C:\\downloads\\a.txt')).toBeNull()

    expect(normalizeServerSqlExportTask({}, 's1')).toMatchObject({
      status: TaskStatus.PENDING,
      tableCount: 0,
      sessionId: 's1'
    })
  })

  it.each([true, false])('requires a server id to pause, but not resume, a local upload (id=%s)', (hasServerId) => {
    const task = {
      type: TaskType.UPLOAD,
      status: TaskStatus.UPLOADING,
      isManagedLocally: true,
      serverTaskId: hasServerId ? 'upload' : null
    }
    expect(getPrimaryTaskAction(task, icons)?.key || null).toBe(hasServerId ? 'pause' : null)
    task.status = TaskStatus.PAUSED
    expect(getPrimaryTaskAction(task, icons)).toMatchObject({ key: 'resume', label: '继续上传' })
  })

  it('merges server snapshots and keeps unrelated tasks', () => {
    const localDownload = {
      id: 'local-download',
      engineTaskId: 'd1',
      type: TaskType.DOWNLOAD,
      status: TaskStatus.COMPLETED,
      fileName: 'local.txt'
    }
    const scan = { id: 'scan-1', type: TaskType.SCAN, status: TaskStatus.SCANNING }
    const upload = { id: 'local-upload', type: TaskType.UPLOAD, serverTaskId: 'd1' }
    const sqlExport = { id: 'local-export', type: TaskType.DB_EXPORT, serverTaskId: 'd1' }
    const unmatched = { id: 'unmatched-download', type: TaskType.DOWNLOAD }
    const tasks = buildTaskList({
      localTasks: [localDownload, scan, sqlExport, upload, unmatched],
      serverUploadTasks: [{ serverTaskId: 'd1', type: TaskType.UPLOAD }],
      serverSqlExportTasks: [{ serverTaskId: 'd1', type: TaskType.DB_EXPORT }],
      serverDownloadTasks: [
        {
          viewId: 'server:d1',
          serverTaskId: 'd1',
          type: TaskType.DOWNLOAD,
          status: TaskStatus.DOWNLOADING,
          fileName: 'server.txt'
        }
      ]
    })

    expect(tasks.map((task) => task.viewId)).toEqual([
      'scan-1', 'local-upload', 'local-download', 'unmatched-download', 'local-export'
    ])
    expect(tasks[2]).toMatchObject({
      taskId: 'local-download',
      serverTaskId: 'd1',
      status: TaskStatus.DOWNLOADING,
      fileName: 'server.txt',
      isManagedLocally: true
    })
    expect(tasks[3]).toMatchObject({ serverTaskId: null, isManagedLocally: true })
  })

  it.each(['FAILED', 'CANCELLED', 'PAUSED'])(
    'preserves %s after every byte is transferred',
    (state) => {
      const task = normalizeServerDownloadTask({
        taskId: 'd',
        state,
        expectedLength: 10,
        downloadedBytes: 10,
        downloadPath: 'downloads/file'
      })
      expect(task.status).toBe(state.toLowerCase())
    }
  )

  it('derives stable presentation states and task actions', () => {
    expect(getIndicatorStatus(TaskStatus.PENDING)).toBe('waiting')
    expect(getIndicatorStatus(TaskStatus.FAILED)).toBe('failed')
    expect(
      getPrimaryTaskAction(
        {
          type: TaskType.DB_EXPORT,
          status: TaskStatus.PAUSED,
          isManagedLocally: true
        },
        icons
      )
    ).toMatchObject({ key: 'resume', label: '继续导出' })
  })
})
