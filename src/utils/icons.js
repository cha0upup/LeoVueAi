/**
 * 图标配置映射
 * 统一管理系统中使用的所有图标，全部使用Iconify图标
 */

// 所有图标使用Iconify格式: 'collection:icon-name'
export const icons = {
  // 基础操作
  search: 'mdi:magnify',
  refresh: 'mdi:refresh',
  add: 'mdi:plus',
  edit: 'mdi:pencil',
  delete: 'mdi:delete',
  save: 'mdi:content-save',
  cancel: 'mdi:close',
  close: 'mdi:close',
  download: 'mdi:download',
  upload: 'mdi:upload',
  copy: 'mdi:content-copy',
  move: 'mdi:file-move',

  // 文件操作
  file: 'mdi:file',
  folder: 'mdi:folder',
  files: 'mdi:file-multiple',
  document: 'mdi:file-document',

  // 系统功能
  settings: 'mdi:cog',
  setting: 'mdi:cog',
  user: 'mdi:account',
  menu: 'mdi:menu',
  list: 'mdi:format-list-bulleted',
  view: 'mdi:eye',

  // 代码相关
  code: 'mdi:code-tags',
  codeEdit: 'mdi:code-json',
  codeView: 'mdi:code-braces',
  codeFile: 'mdi:file-code',
  format: 'mdi:code-braces-box',

  // 执行/测试
  play: 'mdi:play-circle',
  pause: 'mdi:pause-circle',
  stop: 'mdi:stop-circle',
  run: 'mdi:run-fast',
  test: 'mdi:test-tube',
  check: 'mdi:check-circle',

  // 解析/分析
  parse: 'mdi:code-json',
  analyze: 'mdi:chart-line',

  // 功能模块
  mask: 'mdi:theater',
  plugin: 'mdi:puzzle',
  fingerprint: 'mdi:fingerprint',
  package: 'mdi:package-variant',
  box: 'mdi:package-variant',

  // 主机/服务器
  server: 'mdi:server',
  computer: 'mdi:computer',
  network: 'mdi:network',
  platform: 'mdi:server-network',
  hardDrive: 'mdi:harddisk',

  // 数据库
  database: 'mdi:database',
  table: 'mdi:table',
  dataBoard: 'mdi:database',

  // 终端/命令行
  terminal: 'mdi:console',
  command: 'mdi:console-line',
  monitor: 'mdi:monitor',

  // 屏幕/截图
  screen: 'mdi:monitor-screenshot',
  camera: 'mdi:camera',

  // 任务/进程
  task: 'mdi:clipboard-list',
  process: 'mdi:application',
  service: 'mdi:cogs',
  eventLog: 'mdi:text-box-search',
  userAccount: 'mdi:account-group',
  firewall: 'mdi:shield-lock',
  networkShare: 'mdi:folder-network',
  installedSoftware: 'mdi:package-variant-closed',
  docker: 'mdi:docker',
  suidCaps: 'mdi:shield-alert',
  persistence: 'mdi:shield-search',
  networkConnection: 'mdi:lan-connect',
  coin: 'mdi:coin',

  // 安全/权限
  lock: 'mdi:lock',
  unlock: 'mdi:lock-open',
  shield: 'mdi:shield',
  key: 'mdi:key',

  // 状态图标
  info: 'mdi:information',
  infoFilled: 'mdi:information',
  warning: 'mdi:alert',
  error: 'mdi:alert-circle',
  success: 'mdi:check-circle',

  // 连接/网络
  connection: 'mdi:link-variant',
  link: 'mdi:link',

  // 其他常用
  loading: 'mdi:loading',
  clock: 'mdi:clock',
  timer: 'mdi:timer',
  star: 'mdi:star',
  filter: 'mdi:filter',
  arrowDown: 'mdi:chevron-down',
  arrowUp: 'mdi:chevron-up',
  /** 圆形发送区向上箭头（对话输入） */
  sendArrow: 'mdi:arrow-up',
  arrowLeft: 'mdi:chevron-left',
  arrowRight: 'mdi:chevron-right',

  // 特殊图标
  postcard: 'mdi:postcard',
  sort: 'mdi:sort',
  cpu: 'mdi:cpu-64-bit',
  videoPlay: 'mdi:play',
  paperclip: 'mdi:paperclip',
  magicStick: 'mdi:magic-staff',
  partlyCloudy: 'mdi:weather-partly-cloudy',
  bell: 'mdi:bell',
  switchButton: 'mdi:power',
  homeFilled: 'mdi:home',
  more: 'mdi:dots-horizontal',
  moreFilled: 'mdi:dots-vertical',

  // 主题相关
  sunny: 'mdi:weather-sunny',
  moon: 'mdi:weather-night',
  brush: 'mdi:palette',

  // 上传相关
  uploadFilled: 'mdi:upload',

  // 文件夹操作
  folderAdd: 'mdi:folder-plus',
  folderOpened: 'mdi:folder-open',
  documentAdd: 'mdi:file-plus',

  // 操作
  plus: 'mdi:plus',
  minus: 'mdi:minus',
  share: 'mdi:share-variant',

  // 文件类型图标
  picture: 'mdi:image',
  video: 'mdi:video',
  musicNote: 'mdi:music-note',
  compress: 'mdi:folder-zip',
  filePdf: 'mdi:file-pdf-box',
  fileWord: 'mdi:file-word-box',
  fileExcel: 'mdi:file-excel-box',
  filePowerPoint: 'mdi:file-powerpoint-box',
  codeJson: 'mdi:code-json',
  markdown: 'mdi:language-markdown',
  fontFile: 'mdi:format-font',
  applicationCog: 'mdi:application-cog',
  bookOpenPageVariant: 'mdi:book-open-page-variant',
  decompress: 'mdi:folder-open-outline',
  circleClose: 'mdi:close-circle',
  circleCheck: 'mdi:check-circle',
  videoPause: 'mdi:pause',
  coffeeCup: 'mdi:coffee',
  copyDocument: 'mdi:file-document-multiple',
  userFilled: 'mdi:account-circle',
  avatar: 'mdi:account-circle',
  pieChart: 'mdi:chart-pie',
  trendCharts: 'mdi:chart-line',

  // 会话/连接相关
  cloud: 'mdi:cloud',
  session: 'mdi:cloud-outline',

  // 网络相关
  proxy: 'mdi:router-network',
  scan: 'mdi:radar',
  port: 'mdi:network-port',

  // 代码/脚本相关
  script: 'mdi:script-text',
  codeGenerator: 'mdi:code-tags',

  // 信息相关
  infoCard: 'mdi:information-outline',

  // AI / 对话
  chatAi: 'mdi:robot-outline',

  // 层级/关系相关
  child: 'mdi:account-plus',
  parasite: 'mdi:link-plus',

  // 视图/显示相关
  fullScreen: 'mdi:fullscreen',
  aim: 'mdi:fullscreen-exit',
  zoomIn: 'mdi:zoom-in',
  zoomOut: 'mdi:zoom-out',
  grid: 'mdi:grid',
  location: 'mdi:map-marker',
  remove: 'mdi:minus-circle',
  rename: 'mdi:form-textbox',
  chmod: 'mdi:shield-key',
  symlink: 'mdi:link-variant',
  copyPath: 'mdi:content-copy'
}
