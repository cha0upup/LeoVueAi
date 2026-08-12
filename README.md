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
| 文档与导出 | marked、md-editor-v3、xlsx、jszip |
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

## 目录结构

```text
src/
  components/          业务组件
    PuppetConsole/     节点控制台工具集
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

- Node.js 20.19+
- npm 9+
- LeoAI 后端默认运行在 `http://127.0.0.1:8082`

### 安装依赖

```bash
npm install
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

发布构建请使用：

```bash
./mvnw clean package
```

`clean` 会先移除 `target/classes/static/` 中上一次构建遗留的哈希资源，避免新旧前端 bundle 同时进入 JAR。

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

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format
```

## 开发约定

- 新的后端接口优先在 `src/services/api/` 下按领域拆分，不直接在组件内散写 URL。
- 节点控制台功能优先放在 `src/components/PuppetConsole/<Feature>/`，并通过 `usePuppetConsoleModules.js` 注册。
- 长对话、SSE、轮询、任务状态这类跨组件逻辑优先沉到 `composables/`。
- Monaco 和 xterm 属于重型依赖，构建分包规则在 `vite.config.js` 中维护。
- 页面样式优先复用全局主题变量，避免单页面硬编码大量孤立颜色。

## 虚拟终端说明

虚拟终端位于 `src/components/PuppetConsole/terminal/`：

- `TerminalConsole.vue`：会话管理、输入写入、输出轮询、搜索、清屏、中断和关闭。
- `TerminalSessionRail.vue`：多终端会话列表和会话级快捷操作。
- `TerminalViewport.vue`：`@xterm/xterm` 实例、尺寸自适应、搜索和链接识别。

终端通过后端 `/puppet-node/command` 接口按 `processId` 维护远端进程。关闭会话、重置工作台或卸载组件时会发送 `stop`，避免远端 shell 残留。

## License

[GPL-3.0](LICENSE)
