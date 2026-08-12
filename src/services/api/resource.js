import http from '../http.js'

/**
 * 读取 puppet 进程 classpath 资源（jar 内 .class、application.yml、xml 等）。
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {('class'|'path')} params.mode  - 'class' 表示传 className，'path' 表示传 resourcePath
 * @param {string} [params.className]     - mode=class 时必填，例如 com.example.Foo
 * @param {string} [params.resourcePath]  - mode=path 时必填，例如 application.yml
 */
export function fetchResourceApi(params) {
  return http.post('/puppet-node/resource/get', params)
}
