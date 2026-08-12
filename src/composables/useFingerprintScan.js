import { nextTick, ref, watch } from 'vue'

import {
  pauseFingerprintScanApi,
  queryFingerprintScanResultApi,
  resumeFingerprintScanApi,
  startFingerprintScanApi,
  stopFingerprintScanApi
} from '@/services/api.js'
import { taskEngine } from '@/components/PuppetConsole/File/TaskEngine.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { useScanTaskLifecycle } from './useScanTaskLifecycle.js'

const SCAN_KIND_FINGERPRINT = 'fingerprint_scan'

/**
 * 指纹扫描逻辑（按协议独立）：负责启动参数和指纹结果展示，通用任务控制由
 * useScanTaskLifecycle 统一管理。
 *
 * @param {import('vue').Ref<string>} sessionIdRef - 会话 ID
 * @param {'tcp'|'http'} protocol - 协议类型
 * @returns 任务列表与操作方法
 */
export function useFingerprintScan(sessionIdRef, protocol) {
  const isStarting = ref(false)
  let startSequence = 0

  watch(sessionIdRef, () => {
    startSequence += 1
    isStarting.value = false
  })

  const getFingerprintResultStats = (task) => {
    const hasResult = task?.result && typeof task.result === 'object'
    const result = hasResult ? task.result : {}
    const results = result.results && typeof result.results === 'object' ? result.results : {}
    const total = Number(result.total ?? task?.targetCount ?? Object.keys(results).length ?? 0)
    const completed = Number(result.completed ?? (hasResult && task?.status === 'STOPPED' ? total : 0))
    const hitCount = Object.values(results).filter(Boolean).length

    return {
      total,
      completed,
      hitCount,
      missCount: Math.max(0, completed - hitCount)
    }
  }

  const syncFingerprintTaskToCenter = (task) => {
    if (!task?.taskCenterId) return

    const stats = getFingerprintResultStats(task)
    const protocolLabel = task.protocol ? task.protocol.toUpperCase() : protocol.toUpperCase()

    taskEngine.hydrateScanTask(task.taskCenterId, {
      status: task.status,
      scanKind: SCAN_KIND_FINGERPRINT,
      backendTaskId: task.taskId,
      targetLabel: `${protocolLabel} · ${task.fingerprintId}`,
      fingerprintId: task.fingerprintId,
      protocol: task.protocol || protocol,
      totalCount: stats.total,
      processedCount: stats.completed,
      targetCount: stats.total,
      progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      hitCount: stats.hitCount,
      missCount: stats.missCount,
      resultSummary: `命中 ${stats.hitCount} / 完成 ${stats.completed}/${stats.total}`,
      result: task.result,
      startTime: task.createTime,
      createdTime: task.createTime,
      createTime: task.createTime,
      endTime: task.result?.finishedAt || (task.status === 'STOPPED' ? Date.now() : null),
      canControl: task.status !== 'STOPPED'
    })
  }

  const lifecycle = useScanTaskLifecycle({
    sessionIdRef,
    queryApi: queryFingerprintScanResultApi,
    pauseApi: pauseFingerprintScanApi,
    resumeApi: resumeFingerprintScanApi,
    stopApi: stopFingerprintScanApi,
    syncTask: syncFingerprintTaskToCenter,
    taskName: '指纹扫描任务'
  })

  const createFingerprintTask = ({ taskId, fingerprintId, protocolType, targets, threads }) => {
    const createTime = Date.now()
    const task = {
      taskId,
      fingerprintId,
      protocol: protocolType,
      targetCount: targets.length,
      status: 'RUNNING',
      result: null,
      createTime,
      isQuerying: false,
      showResult: true
    }

    const protocolLabel = protocolType ? protocolType.toUpperCase() : protocol.toUpperCase()
    task.taskCenterId = taskEngine.createScanTask(
      lifecycle.getSessionId(),
      SCAN_KIND_FINGERPRINT,
      `${protocolLabel} · ${fingerprintId}`,
      targets.length,
      {
        backendTaskId: taskId,
        fingerprintId,
        protocol: protocolType,
        targetCount: targets.length,
        canControl: true,
        fileName: `${protocolLabel} 指纹 · ${fingerprintId}`,
        threads
      }
    )

    return lifecycle.addTask(task)
  }

  const startScan = async (config) => {
    if (isStarting.value) return
    const fingerprintIds = config.fingerprintIds?.length
      ? config.fingerprintIds
      : config.fingerprintId
        ? [config.fingerprintId]
        : []
    if (!fingerprintIds.length) {
      showWarning('请至少选择一个指纹')
      return
    }

    const targets = config.targets || []
    const threads = config.threads ?? 10
    const protocolType = config.protocol || protocol
    const sessionId = lifecycle.getSessionId()
    const sequence = ++startSequence

    isStarting.value = true
    const started = []
    const failed = []
    const failedMessages = []
    try {
      for (const fingerprintId of fingerprintIds) {
        try {
          const response = await startFingerprintScanApi({
            sessionId,
            fingerprintId,
            targets,
            threads
          })
          const taskId = response?.data?.taskId
          if (sequence !== startSequence || sessionId !== lifecycle.getSessionId()) return
          if (!taskId) {
            failed.push(fingerprintId)
            failedMessages.push(`${fingerprintId}: 启动成功但未返回 taskId`)
            continue
          }

          createFingerprintTask({ taskId, fingerprintId, protocolType, targets, threads })
          await nextTick()
          lifecycle.startPolling(taskId)
          started.push(fingerprintId)
        } catch (error) {
          if (sequence !== startSequence || sessionId !== lifecycle.getSessionId()) return
          failed.push(fingerprintId)
          const message = error?.message || error?.response?.data?.msg || '未知错误'
          failedMessages.push(`${fingerprintId}: ${message}`)
        }
      }

      if (sequence !== startSequence || sessionId !== lifecycle.getSessionId()) return
      if (started.length > 0) {
        showSuccess(
          started.length === fingerprintIds.length
            ? started.length > 1
              ? `已启动 ${started.length} 个指纹扫描任务`
              : '指纹扫描任务已启动'
            : `已启动 ${started.length} 个任务，${failed.length} 个失败`
        )
      }
      if (failed.length > 0 && started.length === 0) {
        showError(`启动指纹扫描失败: ${failedMessages.join('；')}`)
      } else if (failed.length > 0) {
        showError(`以下指纹启动失败: ${failedMessages.join('；')}`)
      }
    } finally {
      if (sequence === startSequence) isStarting.value = false
    }
  }

  return {
    tasks: lifecycle.tasks,
    isStarting,
    isRefreshing: lifecycle.isRefreshing,
    startScan,
    queryResult: lifecycle.queryResult,
    remove: lifecycle.remove,
    batchRemove: lifecycle.batchRemove,
    refresh: lifecycle.refresh,
    pause: lifecycle.pause,
    resume: lifecycle.resume,
    stop: lifecycle.stop
  }
}
