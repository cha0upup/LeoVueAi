/**
 * Element Plus 按需引入
 *
 * 仅注册项目中实际使用的 ~50 个组件，替代原来的全量注册 app.use(ElementPlus)。
 * 减少 JS 打包体积约 200-300KB，CSS 体积约 600KB。
 *
 * 注意：消息、确认框、通知等命令式 API
 * 在各自使用的组件中单独 import，不在此处注册。
 */
import { ElAlert, ElAvatar, ElBadge, ElBreadcrumb, ElBreadcrumbItem, ElButton, ElButtonGroup, ElCard, ElCheckbox, ElCheckboxGroup, ElCol, ElCollapse, ElCollapseItem, ElContainer, ElDatePicker, ElDescriptions, ElDescriptionsItem, ElDialog, ElDivider, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElEmpty, ElForm, ElFormItem, ElHeader, ElIcon, ElInput, ElInputNumber, ElLink, ElLoading, ElMain, ElOption, ElOptionGroup, ElPagination, ElPopconfirm, ElPopover, ElProgress, ElRadio, ElRadioButton, ElRadioGroup, ElResult, ElRow, ElScrollbar, ElSegmented, ElSelect, ElSkeleton, ElStatistic, ElSwitch, ElTabPane, ElTable, ElTableColumn, ElTabs, ElTag, ElTooltip, ElTree, ElUpload } from 'element-plus'

// ===========================
// CSS 按需引入（使用预编译 CSS，替代全量 ~800KB index.css）
//
// 第一部分：基础样式（CSS 变量、reset、通用动画等）
// 第二部分：公共依赖（popover/overlay/message-box 等被多个组件共用）
// 第三部分：按组件引入
// ===========================

// — 基础 —
import 'element-plus/theme-chalk/base.css'

// — 公共依赖（不引入则 tooltip/dialog/select 等会缺样式）—
import 'element-plus/theme-chalk/el-popper.css'
import 'element-plus/theme-chalk/el-overlay.css'
import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/el-message-box.css'
import 'element-plus/theme-chalk/el-notification.css'
import 'element-plus/theme-chalk/el-select-dropdown.css'
import 'element-plus/theme-chalk/el-loading.css'

// — 组件 —
import 'element-plus/theme-chalk/el-alert.css'
import 'element-plus/theme-chalk/el-avatar.css'
import 'element-plus/theme-chalk/el-badge.css'
import 'element-plus/theme-chalk/el-breadcrumb.css'
import 'element-plus/theme-chalk/el-breadcrumb-item.css'
import 'element-plus/theme-chalk/el-button.css'
import 'element-plus/theme-chalk/el-button-group.css'
import 'element-plus/theme-chalk/el-card.css'
import 'element-plus/theme-chalk/el-checkbox.css'
import 'element-plus/theme-chalk/el-checkbox-group.css'
import 'element-plus/theme-chalk/el-col.css'
import 'element-plus/theme-chalk/el-collapse.css'
import 'element-plus/theme-chalk/el-collapse-item.css'
import 'element-plus/theme-chalk/el-container.css'
import 'element-plus/theme-chalk/el-date-picker-panel.css'
import 'element-plus/theme-chalk/el-date-picker.css'
import 'element-plus/theme-chalk/el-descriptions.css'
import 'element-plus/theme-chalk/el-descriptions-item.css'
import 'element-plus/theme-chalk/el-dialog.css'
import 'element-plus/theme-chalk/el-divider.css'
import 'element-plus/theme-chalk/el-drawer.css'
import 'element-plus/theme-chalk/el-dropdown.css'
import 'element-plus/theme-chalk/el-dropdown-item.css'
import 'element-plus/theme-chalk/el-dropdown-menu.css'
import 'element-plus/theme-chalk/el-empty.css'
import 'element-plus/theme-chalk/el-form.css'
import 'element-plus/theme-chalk/el-form-item.css'
import 'element-plus/theme-chalk/el-header.css'
import 'element-plus/theme-chalk/el-icon.css'
import 'element-plus/theme-chalk/el-input.css'
import 'element-plus/theme-chalk/el-input-number.css'
import 'element-plus/theme-chalk/el-link.css'
import 'element-plus/theme-chalk/el-main.css'
import 'element-plus/theme-chalk/el-option.css'
import 'element-plus/theme-chalk/el-option-group.css'
import 'element-plus/theme-chalk/el-pagination.css'
import 'element-plus/theme-chalk/el-popconfirm.css'
import 'element-plus/theme-chalk/el-popover.css'
import 'element-plus/theme-chalk/el-progress.css'
import 'element-plus/theme-chalk/el-radio.css'
import 'element-plus/theme-chalk/el-radio-button.css'
import 'element-plus/theme-chalk/el-radio-group.css'
import 'element-plus/theme-chalk/el-result.css'
import 'element-plus/theme-chalk/el-row.css'
import 'element-plus/theme-chalk/el-scrollbar.css'
import 'element-plus/theme-chalk/el-segmented.css'
import 'element-plus/theme-chalk/el-select.css'
import 'element-plus/theme-chalk/el-skeleton.css'
import 'element-plus/theme-chalk/el-statistic.css'
import 'element-plus/theme-chalk/el-switch.css'
import 'element-plus/theme-chalk/el-tab-pane.css'
import 'element-plus/theme-chalk/el-table.css'
import 'element-plus/theme-chalk/el-table-column.css'
import 'element-plus/theme-chalk/el-tabs.css'
import 'element-plus/theme-chalk/el-tag.css'
import 'element-plus/theme-chalk/el-time-picker.css'
import 'element-plus/theme-chalk/el-tooltip.css'
import 'element-plus/theme-chalk/el-tree.css'
import 'element-plus/theme-chalk/el-upload.css'

export const elementPlusComponents = [
  ElAlert,
  ElAvatar,
  ElBadge,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElButtonGroup,
  ElCard,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElCollapse,
  ElCollapseItem,
  ElContainer,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElPopconfirm,
  ElPopover,
  ElProgress,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElResult,
  ElRow,
  ElScrollbar,
  ElSegmented,
  ElSelect,
  ElSkeleton,
  ElStatistic,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTooltip,
  ElTree,
  ElUpload
]

export function setupElementPlus(app) {
  elementPlusComponents.forEach((component) => {
    app.component(component.name, component)
  })
  app.directive('loading', ElLoading.directive)
}
