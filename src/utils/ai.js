/**
 * AI 相关工具函数：Markdown 渲染与时间格式化。
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

// ==================== Markdown 渲染 ====================
marked.use({ breaks: true })

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const normalizeReply = (data) => {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }
  return String(data)
}

/**
 * 将助理回复（字符串或对象）转为可安全插入的 HTML
 * @param {string|object} content - 回复内容
 * @returns {string} HTML 字符串
 */
export function renderAssistantMarkdown(content) {
  const raw = normalizeReply(content)
  if (!raw) return ''
  try {
    const html = marked.parse(raw, { async: false })
    const withChips = injectToolChips(injectShellChips(String(html)))
    return DOMPurify.sanitize(withChips, {
      ADD_ATTR: ['data-tool-key', 'data-shell-result-id', 'data-shell-label']
    })
  } catch {
    return DOMPurify.sanitize(`<pre class="msg-md-fallback">${escapeHtml(raw)}</pre>`)
  }
}

/**
 * 将 [[tool:key]] 或 [[tool:key:标签]] 替换为可点击 chip 按钮。
 * 此函数在 marked 渲染之后、DOMPurify 之前执行，避免 marked 破坏语法。
 * 格式：
 *   [[tool:file]]              → chip，标签显示 key
 *   [[tool:file:文件管理]]     → chip，标签显示"文件管理"
 */
const TOOL_CHIP_RE = /\[\[tool:([a-zA-Z0-9_-]+)(?::([^\]]+))?\]\]/g

function injectToolChips(html) {
  return html.replace(TOOL_CHIP_RE, (_, key, label) => {
    const safeKey = escapeHtml(key)
    const safeLabel = escapeHtml(label || key)
    return `<button class="ai-tool-chip" data-tool-key="${safeKey}" type="button">` +
           `<span class="ai-tool-chip__icon">⚡</span>${safeLabel}</button>`
  })
}

/**
 * 将 [[shell-result:UUID]] 或 [[shell-result:UUID:标签]] 替换为取回代码按钮。
 * 格式：
 *   [[shell-result:uuid]]              → 按钮，标签显示"取回完整代码"
 *   [[shell-result:uuid:查看 WebShell]] → 按钮，标签显示自定义文字
 */
const SHELL_RESULT_RE = /\[\[shell-result:([a-f0-9-]{36})(?::([^\]]+))?\]\]/g

function injectShellChips(html) {
  return html.replace(SHELL_RESULT_RE, (_, id, label) => {
    const safeId    = escapeHtml(id)
    const safeLabel = escapeHtml(label || '取回完整代码')
    return `<button class="ai-shell-chip" data-shell-result-id="${safeId}" ` +
           `data-shell-label="${safeLabel}" type="button">` +
           `<span class="ai-shell-chip__icon">⬇</span>` +
           `<span class="ai-shell-chip__label">${safeLabel}</span></button>`
  })
}

// ==================== 时间格式化 ====================
/**
 * 格式化时间为时钟格式 (HH:mm)
 */
export function formatTurnClock(ts) {
  return typeof ts === 'number'
    ? new Date(ts).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '--:--'
}

/**
 * 格式化处理耗时标签
 */
export function formatElapsedLabel(startedAt, completedAt) {
  if (typeof startedAt !== 'number') return '处理中'
  const end = typeof completedAt === 'number' ? completedAt : Date.now()
  const deltaMs = Math.max(0, end - startedAt)
  const seconds = Math.max(1, Math.round(deltaMs / 1000))
  return `已处理 ${seconds}s`
}
