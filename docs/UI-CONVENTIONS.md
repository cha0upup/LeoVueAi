# UI 视觉与交互约定

本文是 LeoVueAi 前端的视觉/交互一致性参考。新加模块、改动既有模块时请遵循本文约定。

> **不要**机械照搬。当你的模块有合理的差异（例如对话式界面、表单为主的页面），按业务需要灵活调整，但需要在 PR 描述中说明偏离原因。

---

## 1. 模块布局模式

### 1.1 list + detail（左侧列表 + 右侧详情）

**适用模块**：DisguiseManager、FingerprintManager、PluginManager、SessionManager、PuppetManager、SkillManager

**结构骨架**

```
home-content module-shell
└── {module}-stage  (gap: var(--module-gap))
    ├── page-toolbar  (高度 var(--module-header-height))
    │   ├── toolbar-title (icon + h1)
    │   └── toolbar-stats (chips × N)
    │
    └── workspace-shell  (flex 行)
        ├── list-panel  (固定/可拖拽宽度，使用 SplitterBar 分隔)
        │   ├── panel-header / scope-tabs
        │   ├── toolbar-stack (search + filter + actions)
        │   └── list-scroll (item × N)
        │
        └── detail-panel  (flex: 1, min-width: 0)
            ├── detail-header (title + tags + actions)
            └── content-area
```

### 1.2 tree + editor（文件树 + 编辑器）

**适用模块**：UserSpace、SkillManager 详情区

**约束**：使用通用 `<SplitterBar>` 分隔；空状态用 `<el-empty>` + 引导提示，不要纯文字。

### 1.3 form-centric / category + content

**适用模块**：ScriptGenerator（form）、SettingsManager（category）

**约束**：仅遵循字号/间距/颜色 token，结构按业务自由设计。

---

## 2. 字号阶梯

| 用途 | token / 数值 | 备注 |
|------|-------------|------|
| 模块标题 h1 | 15px / 600 | `.title-row h1` |
| 面板标题 h2 | 13px / 600 | `.panel-header h2` |
| 详情标题 | 16px / 600 | `.detail-title h2` |
| 卡片标题（列表项 strong）| 13px / 600 | |
| 正文 | 13px / 400 | 默认 |
| 描述/次级 | 12px | `.item-desc` |
| 元信息（meta）| 11px | 时间、字节数、提示 |

> 不要超过 5 级字号梯度，避免视觉噪音。

---

## 3. 间距阶梯

直接使用 `--el-spacing-*`（已在 global.css 定义）：

```
xs:    4px   元素内最小间距
small: 6px   chip/tag 之间
base: 10px   常规间距
medium: 14px 模块顶栏与主体
large: 18px  对话框/section 之间
xl:   24px   首屏留白
```

---

## 4. 颜色与状态

### 4.1 主色用法

- 用于**强调主操作、激活态**，避免大面积铺色
- active / selected：`color-mix(in srgb, var(--el-color-primary) 7-10%, ...)`
- hover 边框：`color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color))`

### 4.2 状态颜色

| 状态 | 颜色 | 使用场景 |
|------|------|---------|
| 信息 | `--el-color-info` | 总数、标签筛选 |
| 成功 | `--el-color-success` | 启用项数量、导入成功 |
| 警告 | `--el-color-warning` | 未保存、即将删除 |
| 危险 | `--el-color-danger` | 删除按钮、错误 |
| 主要 | `--el-color-primary` | 筛选、导出主操作 |

### 4.3 禁用态

```css
.disabled {
  opacity: var(--disabled-opacity);          /* 0.55 */
  filter: saturate(var(--disabled-saturation)); /* 0.4 */
}
.disabled:hover {
  opacity: var(--disabled-opacity-hover);     /* 0.85 */
  filter: saturate(var(--disabled-saturation-hover)); /* 0.7 */
}
```

或直接用工具类 `.u-disabled`。

---

## 5. 列表项规范

```vue
<div
  class="skill-item"
  :class="{ active, disabled, 'is-selected': inBatch, 'has-selection': batchMode }"
  role="button"
  tabindex="0"
  @click="onClick"
  @keyup.enter="onClick"
>
  <div class="item-top">
    <div class="item-checkbox">...</div>     <!-- 多选模式时显示 -->
    <div class="item-icon">...</div>          <!-- 32×32, 圆角 -->
    <div class="item-main">
      <div class="item-title-row">
        <strong>{{ name }}</strong>
        <span class="item-file-count">...</span> <!-- 元信息 chip -->
      </div>
      <span class="item-desc">{{ description }}</span>
      <div class="item-tags">...</div>
    </div>
    <div class="item-aside">
      <el-tag v-if="!enabled">禁用</el-tag>
      <button class="item-action-btn">...</button> <!-- hover 时显示 -->
    </div>
  </div>
</div>
```

### 列表项交互态

| 状态 | 视觉 |
|------|------|
| 默认 | 透明边框，浅色背景 |
| hover | 边框 primary 20% |
| active（已打开） | 左侧 3px primary 高亮 + 浅蓝背景 |
| selected（多选）| 边框 primary 40%，背景 primary 5% |
| disabled | opacity 0.55 + saturate 0.4 |

---

## 6. 操作按钮约定

### 6.1 主操作（每个面板最多一个）
`type="primary"`，固定文案 + icon。例：新建、保存、导出。

### 6.2 次要操作
默认 button，无 type。例：取消、刷新、重置。

### 6.3 危险操作
`type="danger"`，必须二次确认。例：删除。

### 6.4 hover 隐式操作
列表项内的导出/复制等：默认 `display: none`，`.skill-item:hover` 时 `display: inline-flex`。
使用 `.u-icon-btn` 类保证视觉一致。

### 6.5 批量操作条
- sticky 在列表顶部，背景 `color-mix(primary 10%, card-bg)`
- 主操作 primary，次要 text 模式
- 触发的 watcher：scope 切换 / 搜索结果变化时自动清空选中

---

## 7. 表单与对话框

### 7.1 对话框宽度
- 简单确认：`400-500px`
- 表单：`520-640px`
- 复杂内容（导入结果表）：`640-800px`

### 7.2 表单字段
- 标签宽度统一 `96px`
- 必填字段后加红色 `*`，不要写 "（必填）"
- 错误信息直接放在字段下方

### 7.3 提交按钮
- 始终在右下角
- 主按钮在右，取消在左
- loading 状态 disable 取消按钮，避免误操作

---

## 8. 加载、空状态、错误

| 场景 | 推荐方式 |
|------|---------|
| 列表加载 | `<el-skeleton :rows="6" animated />` |
| 卡片内 | `<el-skeleton :rows="3" animated />` |
| 列表为空 | `<el-empty description="..." :image-size="80" />` |
| 详情未选中 | `<el-empty description="从左侧选择..." :image-size="80" />` |
| 请求失败 | toast + 在 UI 显示错误信息和重试按钮 |

---

## 9. 动效

直接使用 token：

```css
transition: border-color var(--motion-base) var(--motion-easing);
transition: background var(--motion-fast) var(--motion-easing);
```

- `--motion-fast` (0.12s)：hover、按下
- `--motion-base` (0.18s)：状态切换
- `--motion-slow` (0.3s)：折叠、抽屉

**避免**：超过 0.4s 的过渡、bouncing easing 用在大块布局上。

---

## 10. 可访问性 baseline

- 列表项用 `role="button" tabindex="0"`，`@keyup.enter` 触发主操作
- 有焦点态：使用 `.u-focusable` 或 `:focus-visible { outline: var(--focus-outline) }`
- 颜色对比度：禁用态以外的所有文本满足 4.5:1
- 图标按钮必须有 `el-tooltip` 或 `aria-label`

---

## 11. 命名约定

| 前缀 | 范围 |
|------|------|
| `--el-*` | Element Plus 内置变量，**不要**新增 |
| `--app-*` | 全局应用层（global.css） |
| `--module-*` / `--panel-*` / `--list-*` 等 | 本文 token（design-tokens.css） |
| `--{module}-*` | 模块私有变量 |
| `.u-*` | 工具类（utility class） |
| `.workbench-*` | 跨模块共享类 |

---

## 12. 反模式（不要做）

- ❌ 在组件内硬写 `font-size: 14px`、`padding: 10px 14px`，改为 token
- ❌ 自创新的 z-index 数字，使用 `--z-*` token
- ❌ 用 `el-message-box` 做删除确认，使用 `executeDeleteWithConfirm`
- ❌ hover 时切换 layout（高度突变），只切换颜色和 opacity
- ❌ 在 list 项里塞 4+ 个操作按钮，超过两个就用 dropdown
- ❌ 把状态 chip 放进列表项左侧 icon 位置，应放在 aside 区

---

## 13. 模块检查清单

1. 引入 design tokens：`@import '@/styles/design-tokens.css'` 已全局注入，模块无需手动 import
2. 替换硬编码尺寸：`grep -rn "font-size: \d\+px" src/components/{Module}/`，改用 token
3. 替换硬编码动效：`transition: ... 0.18s` → `var(--motion-base) var(--motion-easing)`
4. 列表项类名按 §5 命名
5. 对照 §6 检查操作按钮位置和 type
6. 对照 §10 加 `role` 和 focus 样式

---

## 14. 工程实践

- 不写新的 markdown 文档堆叠，**统一**遵循本文
- 新增 token 必须在本文记录用途
- 重大视觉调整要附 before/after 截图
- 跨模块组件抽出后放在 `src/components/common/`，共享样式放 `src/styles/`
