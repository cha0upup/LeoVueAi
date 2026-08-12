import { nextTick, ref, watch } from 'vue'

import {
  pauseReconScanApi,
  queryReconScanResultApi,
  resumeReconScanApi,
  startReconScanApi,
  stopReconScanApi
} from '@/services/api.js'
import { taskEngine } from '@/components/PuppetConsole/File/TaskEngine.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { useScanTaskLifecycle } from './useScanTaskLifecycle.js'

const SCAN_KIND_RECON = 'recon_scan'

/**
 * 侦察扫描逻辑：负责规则选择和结果统计，通用任务控制由
 * useScanTaskLifecycle 统一管理。
 *
 * @param {import('vue').Ref<string>} sessionIdRef - 会话 ID
 * @returns 任务列表与操作方法
 */
export function useReconScan(sessionIdRef) {
  const isStarting = ref(false)
  let startSequence = 0

  watch(sessionIdRef, () => {
    startSequence += 1
    isStarting.value = false
  })

  const getReconStats = (task) => {
    const result = task?.result ?? {}
    const total = Number(result.total ?? 0)
    const completed = Number(result.completed ?? 0)
    const matched = result.matched ?? {}
    const hitTargets = Object.values(matched).filter(
      (rules) => Array.isArray(rules) && rules.length > 0
    ).length
    const totalTargets = Number(result.targetCount ?? task?.targetCount ?? 0)
    const ruleCount = Number(result.ruleCount ?? task?.ruleCount ?? 0)

    return { total, completed, hitTargets, totalTargets, ruleCount }
  }

  const buildTaskLabel = (task) => {
    const protocolLabel = task.selectorProtocol
      ? `${task.selectorProtocol.toUpperCase()} · `
      : ''
    return `${protocolLabel}侦察 · ${task.ruleCount ?? 0} 条规则 → ${task.targetCount ?? 0} 个目标`
  }

  const syncReconTaskToCenter = (task) => {
    if (!task?.taskCenterId) return

    const stats = getReconStats(task)
    const label = buildTaskLabel(task)

    taskEngine.hydrateScanTask(task.taskCenterId, {
      status: task.status,
      scanKind: SCAN_KIND_RECON,
      backendTaskId: task.taskId,
      targetLabel: label,
      totalCount: stats.total,
      processedCount: stats.completed,
      targetCount: stats.totalTargets,
      ruleCount: stats.ruleCount,
      progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      hitCount: stats.hitTargets,
      resultSummary: `命中目标 ${stats.hitTargets} / ${stats.totalTargets}`,
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
    queryApi: queryReconScanResultApi,
    pauseApi: pauseReconScanApi,
    resumeApi: resumeReconScanApi,
    stopApi: stopReconScanApi,
    syncTask: syncReconTaskToCenter,
    applyResult(task, result) {
      if (result.ruleCount != null) task.ruleCount = Number(result.ruleCount)
      if (result.targetCount != null) task.targetCount = Number(result.targetCount)
    },
    taskName: '侦察扫描任务'
  })

  const createReconTask = ({ taskId, targets, ruleSelector, ruleCount, threads }) => {
    const createTime = Date.now()
    const task = {
      taskId,
      targetCount: targets.length,
      ruleCount,
      selectorProtocol: ruleSelector?.protocol ?? null,
      selectorTags: ruleSelector?.tags ?? [],
      selectorFingerprintIds: ruleSelector?.fingerprintIds ?? [],
      status: 'RUNNING',
      result: null,
      createTime,
      isQuerying: false,
      showResult: true
    }

    const label = buildTaskLabel(task)
    task.taskCenterId = taskEngine.createScanTask(
      lifecycle.getSessionId(),
      SCAN_KIND_RECON,
      label,
      targets.length * ruleCount,
      {
        backendTaskId: taskId,
        targetCount: targets.length,
        ruleCount,
        canControl: true,
        fileName: label,
        threads
      }
    )

    return lifecycle.addTask(task)
  }

  /**
   * @param {object} config
   * @param {Array} config.targets - 目标列表
   * @param {object} config.ruleSelector - 规则选择器 {protocol?, tags?, fingerprintIds?}
   * @param {number} config.threads - 并发线程数
   */
  const startScan = async (config) => {
    if (isStarting.value) return
    const targets = config.targets ?? []
    const ruleSelector = config.ruleSelector ?? {}
    const threads = config.threads ?? 10

    if (targets.length === 0) {
      showError('请至少填写一个目标')
      return
    }

    const sessionId = lifecycle.getSessionId()
    const sequence = ++startSequence
    isStarting.value = true
    try {
      const response = await startReconScanApi({
        sessionId,
        targets,
        ruleSelector,
        threads
      })
      if (sequence !== startSequence || sessionId !== lifecycle.getSessionId()) return
      const taskId = response?.data?.taskId
      if (!taskId) {
        showError('启动侦察扫描失败')
        return
      }

      // 精确规则模式可立即得到数量；其他选择模式由首次轮询返回权威值。
      const estimatedRuleCount = ruleSelector.fingerprintIds?.length ?? 0
      createReconTask({
        taskId,
        targets,
        ruleSelector,
        ruleCount: estimatedRuleCount,
        threads
      })
      await nextTick()
      lifecycle.startPolling(taskId)
      showSuccess('侦察扫描任务已启动')
    } catch {
      if (sequence === startSequence && sessionId === lifecycle.getSessionId()) {
        showError('启动侦察扫描失败')
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
