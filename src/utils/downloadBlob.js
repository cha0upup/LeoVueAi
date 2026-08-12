/**
 * 触发浏览器下载一个 Blob 内容的文件。
 *
 * 关键点：
 * 1. 把 <a> 显式挂到 DOM 上再 click，确保浏览器执行下载动作。
 * 2. 延迟 revoke，避免下载启动前释放 URL。
 * 3. revoke 走 window 全局 setTimeout，组件卸载也能继续生效；
 *    1 秒后 URL 释放，不会长期占用内存。
 *
 * @param {Blob} blob 要下载的 Blob 内容
 * @param {string} filename 默认文件名
 */
export function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new TypeError('downloadBlob: 第一个参数必须是 Blob')
  }
  if (!filename || typeof filename !== 'string') {
    throw new TypeError('downloadBlob: 必须提供文件名')
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
