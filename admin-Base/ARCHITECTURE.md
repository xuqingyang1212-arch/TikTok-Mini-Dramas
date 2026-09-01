# 管理后台架构设计与开发规范

> 适用范围：本目录中的 Next.js 管理后台，不包含 `backend/`。本文是管理后台后续功能迭代的约束文档；新增页面或功能必须遵守，确需偏离时应先更新本文并说明原因。

## 1. 架构目标

管理后台采用 Next.js App Router + React + TypeScript 的模块化前端架构：

- 菜单、页面注册和前端权限使用单一真相源。
- HTTP、格式化、筛选、分页和公共交互组件集中复用。
- 业务组件负责页面状态与业务交互，不重复实现基础设施。
- 前端权限只改善体验，服务端权限才是安全边界。

```mermaid
flowchart LR
    App[App Router] --> Layout[后台布局]
    Layout --> Registry[菜单注册表]
    Registry --> Page[业务页面组件]
    Page --> Hooks[共享 Hooks]
    Page --> Shared[共享组件]
    Page --> API[API Service]
    API --> Client[统一 API Client]
    Client --> Server[Go /api/v1]
```

## 2. 目录职责

```text
admin-Base/
├── app/                    # App Router、根布局、登录页和全局样式
├── components/             # 业务页面和后台框架组件
│   └── shared/             # 与业务领域无关的通用 UI 组件
├── hooks/                  # 分页、筛选、下拉数据等复用状态逻辑
├── lib/
│   ├── menu-registry.tsx   # 菜单、页面和前端权限单一真相源
│   ├── api-client.ts       # Token、请求、响应和错误处理
│   ├── api.ts              # 按领域组织的接口方法
│   ├── format.ts           # UTC 时间和展示格式
│   ├── permissions.ts      # 从注册表派生的权限结构
│   └── types.ts            # 跨页面共享类型
├── public/                 # 静态资源
└── backend/                # 独立 Go 服务端项目
```

依赖方向：

```text
app/layout → menu registry → business components
business components → hooks/shared/lib
hooks → lib
api.ts → api-client.ts
```

`lib` 和共享组件不得反向依赖具体业务页面。

## 3. 菜单、路由与权限单一真相源

[lib/menu-registry.tsx](./lib/menu-registry.tsx) 是前端业务菜单的唯一声明位置，并派生：

- 侧边栏菜单。
- 页面组件分发。
- 面包屑或父子关系。
- 权限映射。
- 叶子节点顺序。

新增管理页面时：

1. 创建业务页面组件。
2. 在 `menuRegistry` 对应分组添加 `{ key, label, permission, component }`。
3. 在服务端 `internal/consts/permissions.go` 声明匹配的权限 key。
4. 在服务端路由使用 `RequirePerm` 保护接口。

禁止再到布局、侧边栏和内容分发组件中分别维护相同页面配置。

前端按钮隐藏不是授权机制。新增、编辑、删除、导出等敏感操作必须有服务端权限校验。

## 4. API 访问规范

### 4.1 统一传输层

所有后台请求必须通过 [lib/api-client.ts](./lib/api-client.ts)，统一处理：

- API Base URL。
- JWT Token。
- JSON 编解码。
- HTTP 和业务错误。
- 登录失效处理。
- 请求选项。

禁止在业务组件中散落原生 `fetch`、重复拼 Token 或自行解析不同响应格式。

### 4.2 领域 API

接口方法集中在 [lib/api.ts](./lib/api.ts)，按应用、短剧、用户、订单、订阅等领域组织。页面只调用语义化方法，不拼接接口路径。

新增或修改接口时必须：

- 同步 TypeScript 请求/响应类型。
- 保持服务端字段命名一致。
- 将可选查询条件明确序列化。
- 不把异常转换为空数据；由页面统一展示失败状态。

### 4.3 媒体和时间

- 媒体相对路径通过公共方法转换成可访问 URL。
- API 时间按 UTC 解析。
- 后台统一以 `Asia/Shanghai` 显示到秒。
- 日期筛选按中国运营日转换为 UTC 左闭右开区间。
- 禁止页面自行截取时间字符串或手写时区偏移。

格式化入口：[lib/format.ts](./lib/format.ts)。

## 5. 页面与状态设计

### 5.1 页面组件

一个业务页面通常只负责：

- 字段和列定义。
- 筛选条件组合。
- 调用领域 API。
- 打开表单、确认框或详情抽屉。
- 展示成功和失败反馈。

当组件同时承担大量请求、转换、表格、抽屉和状态机逻辑时，应优先拆出 Hook、子组件或领域工具，而不是继续扩大单文件。

### 5.2 分页与筛选

列表页面优先使用：

- [hooks/use-paged-query.ts](./hooks/use-paged-query.ts)：请求、分页、刷新、加载和错误状态。
- [hooks/use-filters.ts](./hooks/use-filters.ts)：筛选草稿与已应用条件。
- [hooks/use-pagination.ts](./hooks/use-pagination.ts)：只需要分页状态时使用。

规则：

- 页码和每页数量是请求状态的一部分。
- 应用新筛选时回到第一页。
- 切换不同详情 Tab 时应使用独立 key 或状态，避免分页串用。
- 请求错误必须可见，不能静默显示为空列表。
- 服务端必须在数据库分页之前应用筛选。

### 5.3 下拉数据

应用和短剧等跨页面下拉选项使用：

- [hooks/use-app-options.ts](./hooks/use-app-options.ts)
- [hooks/use-drama-options.ts](./hooks/use-drama-options.ts)

新增可复用字典或级联选项时，应建立相同模式的 Hook，统一加载、转换和错误处理，不在多个页面复制请求。

## 6. 共享组件规范

通用后台交互位于 [components/shared/](./components/shared)：

- `confirm-dialog` / `popconfirm`：危险操作确认。
- `right-drawer`：详情和编辑抽屉。
- `fixed-header-table`：固定表头表格。
- `filter-bar`、`filter-input`、`select-filter`：筛选区域。
- `date-range-picker`：运营日期范围。
- `form-input`、`form-select`、`field-error`：表单和字段错误。
- `status-badge`：状态展示。
- `column-settings`：列配置。

新增组件前先判断是否为通用能力：

- 通用能力放 `components/shared`，API 应保持领域无关。
- 业务专用组件放对应业务组件附近。
- 不为一个页面复制已有弹窗、抽屉、筛选栏或分页实现。

## 7. 业务展示规范

### 用户权益记录

用户详情必须区分业务来源：

- Beans 解锁独立 Tab，展示“关联订单号”。
- 广告解锁独立 Tab，展示“广告会话号”。
- 会员记录、观看记录保持独立分页。

禁止在 Beans 页面显示广告会话号，或使用“关联凭证”等含义不清的字段名。

### IAA/IAP 配置

- 应用变现模式是应用级配置，值为 `IAA` 或 `IAP`。
- IAA 展示广告位相关配置。
- IAP 展示 Beans、付费卡点和订阅配置。
- 切换变现模式时应明确提示对既有流程的影响。
- 前端显隐规则必须与服务端约束一致，但不能替代服务端校验。

## 8. TypeScript 与错误处理

- 保持 TypeScript strict 模式。
- API DTO 应显式定义，不使用 `any` 绕过接口变化。
- 领域状态优先使用联合类型，例如 `"IAA" | "IAP"`。
- 服务端返回的可空字段必须在类型中体现。
- 用户可恢复错误使用 toast 或字段错误展示。
- 破坏性操作必须确认，并在请求进行中防止重复提交。
- 不吞掉 Promise rejection，也不以空数组伪装加载失败。

## 9. 新功能开发流程

新增一个后台模块时按以下顺序：

1. 确认后端 API、权限 key、请求和响应 DTO。
2. 在 `lib/types.ts` 或业务局部类型中定义类型。
3. 在 `lib/api.ts` 增加语义化接口方法。
4. 复用分页、筛选、选项和公共组件完成页面。
5. 在 `menu-registry.tsx` 注册页面和权限。
6. 对新增、修改、删除和导出操作确认服务端权限保护。
7. 处理加载、空状态、失败状态和重复提交。
8. 运行 TypeScript 检查与生产构建。

### 禁止事项

- 在业务组件中直接调用散落的 `fetch`。
- 在多个文件重复维护菜单、页面映射或权限树。
- 新写一套分页、抽屉、确认框或时间格式化逻辑。
- 用前端隐藏按钮代替服务端授权。
- 把 IAA 与 IAP 的业务记录混入同一个含义不清的列。
- 将 API 错误静默转换为空列表。

## 10. 验证要求

管理后台变更至少运行：

```bash
cd admin-Base
pnpm exec tsc --noEmit --incremental false
pnpm run build
```

涉及交互或布局时，还应在浏览器验证：

- 目标菜单和权限显隐。
- 列表筛选、分页和刷新。
- 表单校验和错误反馈。
- 抽屉、确认框和危险操作。
- `Asia/Shanghai` 时间展示。
- 实际运行进程是否来自当前工作目录，避免旧开发进程造成错误判断。

## 11. 演进边界

当前管理后台服务于演示环境，可以保持轻量组件体系和客户端页面分发。进入生产化阶段时，可以增加更完整的测试、监控和设计系统，但应继续保留：

- 菜单和页面注册单一真相源。
- 统一 API 客户端。
- 前后端双层权限。
- 公共 Hooks 和组件复用。
- UTC 输入与中国运营时区展示的明确边界。
