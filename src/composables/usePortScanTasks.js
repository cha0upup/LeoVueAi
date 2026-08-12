import { nextTick, ref, watch } from 'vue'

import {
  pausePortScanApi,
  queryPortScanResultApi,
  resumePortScanApi,
  startPortScanApi,
  stopPortScanApi
} from '@/services/api.js'
import { taskEngine } from '@/components/PuppetConsole/File/TaskEngine.js'
import {
  applyPortScanResult,
  createPortScanTaskModel,
  getPortScanTaskStats,
  PORT_SCAN_KIND
} from '@/components/PuppetConsole/Scan/portScanModel.js'
import { showError, showInfo, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { useScanTaskLifecycle } from './useScanTaskLifecycle.js'

export function usePortScanTasks(sessionIdRef) {
  const isStarting = ref(false)
  let startSequence = 0

  watch(sessionIdRef, () => {
    startSequence += 1
    isStarting.value = false
  })

  const syncTaskToCenter = task => {
    if (!task?.taskCenterId) return
    const stats = getPortScanTaskStats(task)
    taskEngine.hydrateScanTask(task.taskCenterId, {
      status: task.status,
      scanKind: PORT_SCAN_KIND,
      backendTaskId: task.taskId,
      targetLabel: task.scanHost,
      scanHost: task.scanHost,
      totalCount: stats.portLength,
      processedCount: stats.scannedCount,
      portLength: stats.portLength,
      scannedCount: stats.scannedCount,
      progress: task.progress,
      hitCount: stats.openCount,
      missCount: stats.missCount,
      openPortList: task.openPortList,
      resultSummary: `开放 ${stats.openCount} / 已扫描 ${stats.scannedCount}/${stats.portLength}`,
      startTime: task.createTime,
      createdTime: task.createTime,
      createTime: task.createTime,
      endTime: task.endTime || null,
      canControl: task.status !== 'STOPPED',
      options: {
        scanPorts: task.scanPorts,
        scanTimeout: task.scanTimeout,
        threadsNum: task.threadsNum
      }
    })
  }

  const lifecycle = useScanTaskLifecycle({
    sessionIdRef,
    queryApi: queryPortScanResultApi,
    pauseApi: pausePortScanApi,
    resumeApi: resumePortScanApi,
    stopApi: stopPortScanApi,
    extractResult: response => response?.data?.scanTaskInfo,
    applyResult: applyPortScanResult,
    syncTask: syncTaskToCenter,
    onTerminal(task) {
      const stats = getPortScanTaskStats(task)
      if (stats.completed) showSuccess('扫描任务已完成')
      else showInfo('扫描任务已终止')
    },
    taskName: '端口扫描任务'
  })

  const addStartedTask = ({ taskId, scanHost, scanPorts = [], scanTimeout, threadsNum }) => {
    const task = createPortScanTaskModel({ taskId, scanHost, scanPorts, scanTimeout, threadsNum })
    task.taskCenterId = taskEngine.createScanTask(
      lifecycle.getSessionId(),
      PORT_SCAN_KIND,
      scanHost,
      task.portLength,
      {
        backendTaskId: taskId,
        scanHost,
        scanPorts: task.scanPorts,
        scanTimeout,
        threadsNum,
        portLength: task.portLength,
        canControl: true,
        fileName: `端口扫描 · ${scanHost}`
      }
    )
    lifecycle.addTask(task)
    lifecycle.startPolling(taskId)
    return task
  }

  const requestStart = async ({ sessionId, scanHost, scanPorts, scanTimeout, threadsNum }) => {
    const response = await startPortScanApi({ sessionId, scanHost, scanPorts, scanTimeout, threadsNum })
    const taskId = response?.data?.taskId
    if (!taskId) throw new Error('扫描服务未返回 taskId')
    if (sessionId !== lifecycle.getSessionId()) return null
    return addStartedTask({ taskId, scanHost, scanPorts, scanTimeout, threadsNum })
  }

  const start = async config => {
    if (isStarting.value) return null
    const sessionId = lifecycle.getSessionId()
    const sequence = ++startSequence
    isStarting.value = true
    try {
      const task = await requestStart({ sessionId, ...config })
      if (task) {
        await nextTick()
        showSuccess('扫描任务已启动')
      }
      return task
    } catch (error) {
      if (sessionId === lifecycle.getSessionId()) {
        if (String(error?.message || '').includes('taskId')) showWarning(error.message)
        else showError('启动扫描任务失败')
      }
      return null
    } finally {
      if (sequence === startSequence) isStarting.value = false
    }
  }

  const startBatch = async ({ hosts, scanPorts, scanTimeout, threadsNum }) => {
    if (isStarting.value) return { successCount: 0, failCount: 0 }
    const uniqueHosts = [...new Set((Array.isArray(hosts) ? hosts : []).map(String).map(host => host.trim()).filter(Boolean))]
    if (!uniqueHosts.length) {
      showWarning('请至少选择一个主机')
      return { successCount: 0, failCount: 0 }
    }
    if (!Array.isArray(scanPorts) || !scanPorts.length) {
      showWarning('请至少选择一个端口')
      return { successCount: 0, failCount: 0 }
    }

    const sessionId = lifecycle.getSessionId()
    const sequence = ++startSequence
    isStarting.value = true
    try {
      const results = await Promise.allSettled(uniqueHosts.map(scanHost => requestStart({
        sessionId,
        scanHost,
        scanPorts,
        scanTimeout,
        threadsNum
      })))
      if (sessionId !== lifecycle.getSessionId()) return { successCount: 0, failCount: 0 }
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length
      const failCount = uniqueHosts.length - successCount
      if (successCount > 0) {
        showSuccess(`成功创建 ${successCount} 个扫描任务${failCount ? `，失败 ${failCount} 个` : ''}`)
      } else {
        showError('批量创建扫描任务失败')
      }
      return { successCount, failCount }
    } finally {
      if (sequence === startSequence) isStarting.value = false
    }
  }

  return {
    tasks: lifecycle.tasks,
    isStarting,
    isRefreshing: lifecycle.isRefreshing,
    start,
    startBatch,
    queryResult: lifecycle.queryResult,
    refresh: lifecycle.refresh,
    remove: lifecycle.remove,
    batchRemove: lifecycle.batchRemove,
    pause: lifecycle.pause,
    resume: lifecycle.resume,
    stop: lifecycle.stop
  }
}
