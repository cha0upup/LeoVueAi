# LeoVueAI

LeoVueAI 是 LeoAI 的前端控制台，基于 Vue 3 + Vite 构建，负责平台管理、节点工作台、AI 助手、Shell 生成、流量伪装、指纹规则、插件脚本和团队后台等交互界面。

后端仓库位于 [LeoAI](https://github.com/cha0upup/LeoAI)。开发时前后端分离运行；发布时前端构建产物会放入后端 `web/src/main/resources/static/`，随 Spring Boot JAR 一起分发。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3、Vue Router 4、Vite 8 |
| UI | Element Plus、Iconify、全局主题变量 |
| 编辑器 | Monaco Editor |
| 终端 | @xterm/xterm、FitAddon、SearchAddon、WebLinksAddon |
| 网络 | Axios、SSE |
| 文档与导出 | marked、DOMPurify、xlsx、CSV |
| 工程质量 | ESLint 10、eslint-plugin-vue、Prettier |

## 主要模块

| 模块 | 说明 |
|------|------|
| 工作台 | 标签页、命令面板、AI Dock、主题与用户菜单 |
| 节点管理 | 节点新增/编辑/导入/分享、代理配置、详情面板 |
| 节点控制台 | 基础信息、文件、虚拟终端、任务、扫描、数据库、代理、Docker、进程、服务、注册表等 |
| AI 助手 | 平台级 AI、节点级 AI、SSE 事件流、线程与运行状态管理 |
| 管理后台 | 用户、团队、AI 配置、审计、会话管理 |
| 工具能力 | Shell 生成、流量伪装、指纹规则、插件/脚本、Skill 管理、用户文件空间 |

管理员可在「项目设置 → 交接负责人」选择已启用账号。候选列表仅在发起交接时加载，失败后可直接重试。交接只变更负责人，项目的共享团队和归档状态保持原样。

审计列表及顶部计数只使用已提交的筛选；编辑后点击「查询」应用。按筛选删除会显示最近一次查询的命中数，提交时仍按相同条件匹配，实际删除数以返回结果为准。列表依赖后端的 `view=summary` 查询，前后端需配套发布。团队列表可按队长姓名或 ID 搜索，新增团队时才查询最新队长候选。

在「审计统计」中，个人、团队和主机卡片的「刷新」针对上一次查询的 ID；使用「查询」应用新输入。操作趋势按日横向排列，长时间范围可滚动浏览。新增用户或重置密码时，校验和提交期间会锁定表单，关闭弹窗后清空密码输入。

初始化、账号创建、密码重置和自行改密的表单统一使用服务端返回的密码长度要求。首次登录完成改密后，若登录状态暂时读不到，后续只重试状态读取，不重复提交密码。

管理后台按当前标签页加载模块。用户列表与团队目录分别读取：团队目录暂时不可用时仍可查看账号，未知的团队名称以 ID 显示；刷新成功后显示团队名称。

「个人信息」会在资料加载完成后显示表单，只有存在实际修改时才启用保存。读取失败可在弹窗内重试，保存失败会保留本次草稿。

成果库切换分类、来源时立即查询，关键词搜索会等待短暂停顿再发出请求。预览弹窗能提示读取进度并直接重试；关闭后取消仍在途的预览请求。

## 目录结构

```text
src/
  components/          业务组件
    AgentConsole/     节点控制台工具集
    Workspace/         主工作台与标签页
    AiAssistant/       通用 AI 对话组件
    Admin/             管理后台
  composables/         可复用状态与业务编排
  services/            Axios 实例与 API 封装
  constants/           路由、模块和默认配置
  styles/              全局主题与布局样式
  views/               Login / Main / Admin 视图
```

## 本地开发

### 环境要求

- 推荐 Node.js 24.14.1（与 `.nvmrc` 和 GitHub Actions 一致）；兼容 Node.js 20.19+、22.13+ 及 24+
- npm 9+
- LeoAI 后端默认运行在 `http://127.0.0.1:8082`

### 安装依赖

```bash
nvm use # 已安装 nvm 时使用；否则直接安装 .nvmrc 指定的 Node.js
npm ci
```

### 启动开发服务器

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:3000
```

前端请求后端的端口来自 `.env.development`：

```env
VITE_API_PORT=8082
```

如后端端口有变化，修改该值后重启 Vite 即可。当前 Axios 基地址由 `src/services/http.js` 根据浏览器协议、主机名和 `VITE_API_PORT` 计算。

首次访问时，若状态接口返回带有效 `Retry-After` 秒数的 503，检查页会自动重试最多 3 次。离开检查页会停止重试；其他错误可手动重新检查。初始化请求已确认或结果不明确时，页面先检查服务端状态，不自动重发初始化表单。通过应用内链接进入初始化时，完成设置并登录后可继续原来的页面。

`.env.development` 仅保存公开的本地开发端口。个人覆盖配置放入 `.env.development.local`，不要把密钥写入任何 `VITE_*` 变量：它们会进入浏览器构建产物。

## 构建与部署

### 构建前端

```bash
npm run build
```

构建产物输出到：

```text
dist/
```

### 集成到 LeoAI 后端

将 `dist/` 内容复制到后端仓库：

```text
<LeoAI>/web/src/main/resources/static/
```

然后在后端仓库执行 Maven 打包，最终由 Spring Boot 内置静态资源服务提供前端页面。

发布前在后端仓库执行完整检查入口：

```bash
python3 tools/verify_release.py --frontend ../LeoVueAi
```

入口会执行前端 lint、测试和构建，逐文件核对 `dist/` 与后端静态目录，检查组件产物，然后执行后端 `clean verify`。静态目录不一致时先同步并审阅差异，再重新运行；检查器保持后端静态文件原样。

`clean` 会先移除 `target/classes/static/` 中上一次构建遗留的哈希资源，避免新旧前端 bundle 同时进入 JAR。本地已准备依赖时可添加 `--skip-install`，CI 从 lockfile 安装。

两个仓库及各 Maven 子模块的版本必须一致；发布检查会在安装依赖前校验 `pom.xml`、`package.json` 和 lockfile 中的版本。依赖使用官方 npm registry 和 SheetJS 官方分发地址；本次整理不升级依赖版本。

本仓库的 GitHub Actions 在推送到 `main`、Pull Request 和手动触发时执行 lint、测试与生产构建，不自动部署。

## 常用命令

```bash
# 开发
npm run dev

# 生产构建
npm run build

# 本地预览构建产物
npm run preview

# ESLint 检查
npm run lint

# 回归测试
npm test

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format
```

## 开发约定

- 新的后端接口优先在 `src/services/api/` 下按领域拆分，不直接在组件内散写 URL。
- 节点控制台功能优先放在 `src/components/AgentConsole/<Feature>/`，并通过 `useAgentConsoleModules.js` 注册。
- 长对话、SSE、轮询、任务状态这类跨组件逻辑优先沉到 `composables/`。
- Monaco 和 xterm 属于重型依赖，构建分包规则在 `vite.config.js` 中维护。
- 页面样式优先复用全局主题变量，避免单页面硬编码大量孤立颜色。

## 虚拟终端说明

虚拟终端位于 `src/components/AgentConsole/terminal/`：

- `TerminalConsole.vue`：会话管理、输入写入、输出轮询、搜索、清屏、中断和关闭。
- `TerminalSessionRail.vue`：多终端会话列表和会话级快捷操作。
- `TerminalViewport.vue`：`@xterm/xterm` 实例、尺寸自适应、搜索和链接识别。

终端通过后端 `/agent-node/command` 接口按 `processId` 维护远端进程。关闭会话、重置工作台或卸载组件时会发送 `stop`，避免远端 shell 残留。

## License

[GPL-3.0](LICENSE)
