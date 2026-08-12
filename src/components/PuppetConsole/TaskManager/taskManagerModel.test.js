import { describe, expect, it } from 'vitest'
import { TaskStatus, TaskType } from '@/constants/task.js'
import {
  buildTaskList,
  getDownloadRelativePath,
  getIndicatorStatus,
  getPrimaryTaskAction,
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
  it('normalizes malformed server snapshots and recognizes completed downloads', () => {
    const download = normalizeServerDownloadTask(
      {
        taskId: 'd1',
        sessionId: 's1',
        state: 'RUNNING',
        meta: {
          expectedLength: '10',
          downloadedBytes: '10',
          downloadPath: 'downloads/a.txt'
        }
      },
      'fallback'
    )
    expect(download).toMatchObject({
      serverTaskId: 'd1',
      sessionId: 's1',
      status: TaskStatus.COMPLETED,
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

  it('merges server snapshots, keeps unrelated tasks, and excludes legacy shell tasks', () => {
    const localDownload = {
      id: 'local-download',
      engineTaskId: 'd1',
      type: TaskType.DOWNLOAD,
      status: TaskStatus.COMPLETED,
      fileName: 'local.txt'
    }
    const scan = { id: 'scan-1', type: TaskType.SCAN, status: TaskStatus.SCANNING }
    const legacyShell = { id: 'shell-1', type: 'shell', status: TaskStatus.PENDING }
    const tasks = buildTaskList({
      localTasks: [localDownload, scan, legacyShell],
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

    expect(tasks.map(task => task.viewId)).toEqual(['scan-1', 'local-download'])
    expect(tasks[1]).toMatchObject({
      taskId: 'local-download',
      serverTaskId: 'd1',
      status: TaskStatus.COMPLETED,
      fileName: 'server.txt',
      isManagedLocally: true
    })
  })

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
