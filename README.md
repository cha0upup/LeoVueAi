# LeoVueAI

LeoVueAI 是 [LeoAI](https://github.com/cha0upup/LeoAI) 的网页工作台，用于查看主机与会话、整理项目、使用 AI 助手和管理团队。

## 快速使用

使用 LeoAI 正式发布包时，网页已随服务一起提供，无需单独启动前端。部署和首次登录请参阅 [LeoAI 使用说明](https://github.com/cha0upup/LeoAI)。

如需在本地单独运行前端，请先启动 LeoAI 后端，并使用 `.nvmrc` 指定的 Node.js 版本，在本仓库执行：

```bash
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。如果后端没有使用默认的 `8082` 端口，请调整 `.env.development` 里的 `VITE_API_PORT`，再重启前端。

构建和发布请参阅 [LeoAI 贡献指南](https://github.com/cha0upup/LeoAI/blob/main/CONTRIBUTING.md)。

[问题反馈](https://github.com/cha0upup/LeoVueAi/issues) · [GPL-3.0 许可证](LICENSE)
