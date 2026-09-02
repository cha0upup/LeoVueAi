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
    const targetLabel = task.scanHost || task.scanHosts?.join(', ') || '扫描目标'
    taskEngine.hydrateScanTask(task.taskCenterId, {
      status: task.status,
      scanKind: PORT_SCAN_KIND,
      backendTaskId: task.taskId,
      targetLabel,
      scanHost: task.scanHost,
      totalCount: stats.portLength,
      processedCount: stats.scannedCount,
      portLength: stats.portLength,
      scannedCount: stats.scannedCount,
      progress: task.progress,
      hitCount: stats.openCount,
      missCount: stats.missCount,
      openPortList: task.openPortList,
      openPortResults: task.openPortResults,
      scanHosts: task.scanHosts,
      targets: task.targets,
      targetCount: task.targetCount,
      serviceResults: task.serviceResults,
      resultSummary: `开放 ${stats.openCount} / 已扫描 ${stats.scannedCount}/${stats.portLength}`,
      startTime: task.createTime,
      createdTime: task.createTime,
      createTime: task.createTime,
      endTime: task.endTime || null,
      canControl: task.status !== 'STOPPED',
      options: {
        scanPorts: task.scanPorts,
        scanHosts: task.scanHosts,
        scanTimeout: task.scanTimeout,
        threadsNum: task.threadsNum,
        probeServices: task.probeServices
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

  const addStartedTask = ({ taskId, scanHost, scanHosts, scanPorts = [], scanTimeout, threadsNum, probeServices }) => {
    const task = createPortScanTaskModel({ taskId, scanHost, scanHosts, scanPorts, scanTimeout, threadsNum, probeServices })
    const targetLabel = task.scanHost || task.scanHosts?.join(', ') || '扫描目标'
    task.taskCenterId = taskEngine.createScanTask(
      lifecycle.getSessionId(),
      PORT_SCAN_KIND,
      targetLabel,
      task.portLength,
      {
        backendTaskId: taskId,
        scanHost: task.scanHost,
        scanHosts: task.scanHosts,
        scanPorts: task.scanPorts,
        scanTimeout,
        threadsNum,
        probeServices: task.probeServices,
        portLength: task.portLength,
        canControl: true,
        fileName: `端口扫描 · ${targetLabel}`
      }
    )
    lifecycle.addTask(task)
    lifecycle.startPolling(taskId)
    return task
  }

  const requestStart = async ({ sessionId, scanHost, scanHosts, scanPorts, scanTimeout, threadsNum, probeServices = true }) => {
    const request = { sessionId, scanPorts, scanTimeout, threadsNum, probeServices }
    if (Array.isArray(scanHosts) && scanHosts.length > 0) request.scanHosts = scanHosts
    else request.scanHost = scanHost
    const response = await startPortScanApi(request)
    const taskId = response?.data?.taskId
    if (!taskId) throw new Error('扫描服务未返回 taskId')
    if (sessionId !== lifecycle.getSessionId()) return null
    return addStartedTask({
      taskId,
      scanHost: scanHost || (scanHosts?.length === 1 ? scanHosts[0] : undefined),
      scanHosts,
      scanPorts,
      scanTimeout,
      threadsNum,
      probeServices
    })
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

  const startBatch = async ({ hosts, scanPorts, scanTimeout, threadsNum, probeServices = true }) => {
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
      let results = await Promise.allSettled([requestStart({
        sessionId,
        scanHosts: uniqueHosts,
        scanPorts,
        scanTimeout,
        threadsNum,
        probeServices
      })])
      if (sessionId !== lifecycle.getSessionId()) return { successCount: 0, failCount: 0 }
      let taskCount = results.filter(result => result.status === 'fulfilled' && result.value).length
      let successCount = taskCount > 0 ? uniqueHosts.length : 0
      let failCount = successCount > 0 ? 0 : uniqueHosts.length
      let usedFallback = false
      const unifiedError = results[0]?.status === 'rejected' ? results[0].reason : null
      if (!taskCount && isMultiTargetUnsupported(unifiedError)) {
        usedFallback = true
        results = await Promise.allSettled(uniqueHosts.map(scanHost => requestStart({
          sessionId,
          scanHost,
          scanPorts,
          scanTimeout,
          threadsNum,
          probeServices
        })))
        if (sessionId !== lifecycle.getSessionId()) return { successCount: 0, failCount: 0 }
        taskCount = results.filter(result => result.status === 'fulfilled' && result.value).length
        successCount = taskCount
        failCount = uniqueHosts.length - successCount
      }
      if (successCount > 0) {
        if (usedFallback) {
          showSuccess(`已创建 ${successCount} 个扫描任务${failCount ? `，失败 ${failCount} 个` : ''}`)
        } else {
          showSuccess(`已创建 1 个多目标扫描任务，覆盖 ${uniqueHosts.length} 个主机`)
        }
      } else {
        showError('批量创建扫描任务失败')
      }
      return { successCount, failCount, taskCount: usedFallback ? taskCount : (successCount > 0 ? 1 : 0) }
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

function isMultiTargetUnsupported(error) {
  const message = [
    error?.message,
    error?.response?.data?.msg,
    error?.response?.data?.message
  ].filter(Boolean).join(' ')
  return /不支持多目标|multi.?target/i.test(message)
}
