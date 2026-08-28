package consts

// 权限点 · 单一真相源
//
// 本文件是全后端**唯一**的权限点声明处。所有用到权限 key 的地方，
// 必须引用这里的常量（如 consts.SystemUserList），严禁硬编码字符串。
//
// 新增权限点的步骤：
//   1. 在下面的 const 区追加常量
//   2. 将常量挂进 PermissionTree 对应节点的 Children
//   3. 在 router.go 用 RequirePerm(consts.XXX) 挂到对应路由
//
// 无需改种子 SQL：启动时 main.go 会调 SyncSuperAdminPermissions 以本文件
// 为准，自动把缺失的权限点补进超管角色的 role_permissions。

// PermissionNode 是权限树节点，用于 /permissions/tree 前端展示。
type PermissionNode struct {
	Key      string           `json:"key"`
	Label    string           `json:"label"`
	Children []PermissionNode `json:"children,omitempty"`
}

// ─── 权限 key 常量 ────────────────────────────────────────────────────────

const (
	// ═══════════════════════════════════════════════════════════════════════
	// 资源管理 · 剧集管理
	// ═══════════════════════════════════════════════════════════════════════
	ResourceDramaList   = "resource.drama.list"
	ResourceDramaAdd    = "resource.drama.add"
	ResourceDramaEdit   = "resource.drama.edit"
	ResourceDramaDelete = "resource.drama.delete"

	// ═══════════════════════════════════════════════════════════════════════
	// 金融管理 · 充值订单
	// ═══════════════════════════════════════════════════════════════════════
	FinanceRechargeList   = "finance.recharge.list"
	FinanceRechargeExport = "finance.recharge.export"

	// ═══════════════════════════════════════════════════════════════════════
	// 运营配置 · 应用管理
	// ═══════════════════════════════════════════════════════════════════════
	OperationAppList = "operation.app.list"
	OperationAppAdd  = "operation.app.add"
	OperationAppEdit = "operation.app.edit"

	// ═══════════════════════════════════════════════════════════════════════
	// 用户管理 · 小程序用户
	// ═══════════════════════════════════════════════════════════════════════
	UserAppUserList = "user.appuser.list"
	UserAppUserEdit = "user.appuser.edit"

	// ═══════════════════════════════════════════════════════════════════════
	// 用户管理 · 资产配置
	// ═══════════════════════════════════════════════════════════════════════
	UserAssetList = "user.asset.list"
	UserAssetEdit = "user.asset.edit"

	// ═══════════════════════════════════════════════════════════════════════
	// 运营配置 · 订阅配置
	// ═══════════════════════════════════════════════════════════════════════
	OperationSubsList   = "operation.subs.list"
	OperationSubsAdd    = "operation.subs.add"
	OperationSubsEdit   = "operation.subs.edit"
	OperationSubsDelete = "operation.subs.delete"

	// ═══════════════════════════════════════════════════════════════════════
	// 运营配置 · 支付配置
	// ═══════════════════════════════════════════════════════════════════════
	OperationPaymentList   = "operation.payment.list"
	OperationPaymentAdd    = "operation.payment.add"
	OperationPaymentEdit   = "operation.payment.edit"
	OperationPaymentDelete = "operation.payment.delete"

	// ═══════════════════════════════════════════════════════════════════════
	// 系统管理 · 用户管理（后台账号）
	// ═══════════════════════════════════════════════════════════════════════
	SystemUserList = "system.user.list"
	SystemUserAdd  = "system.user.add"
	SystemUserEdit = "system.user.edit"

	// ═══════════════════════════════════════════════════════════════════════
	// 系统管理 · 角色管理
	// ═══════════════════════════════════════════════════════════════════════
	SystemRoleList = "system.role.list"
	SystemRoleAdd  = "system.role.add"
	SystemRoleEdit = "system.role.edit"
)

// PermissionTree 返回给前端的权限分配界面使用。节点层级：模块 → 子模块 → 操作点。
var PermissionTree = []PermissionNode{
	// ═══════════════════════════════════════════════════════════════════════
	// 资源管理
	// ═══════════════════════════════════════════════════════════════════════
	{
		Key:   "resource",
		Label: "资源管理",
		Children: []PermissionNode{
			{
				Key:   "resource.drama",
				Label: "剧集管理",
				Children: []PermissionNode{
					{Key: ResourceDramaList, Label: "列表数据"},
					{Key: ResourceDramaAdd, Label: "新增"},
					{Key: ResourceDramaEdit, Label: "编辑"},
					{Key: ResourceDramaDelete, Label: "删除"},
				},
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════
	// 金融管理
	// ═══════════════════════════════════════════════════════════════════════
	{
		Key:   "finance",
		Label: "金融管理",
		Children: []PermissionNode{
			{
				Key:   "finance.recharge",
				Label: "充值订单",
				Children: []PermissionNode{
					{Key: FinanceRechargeList, Label: "列表数据"},
					{Key: FinanceRechargeExport, Label: "导出"},
				},
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════
	// 运营配置
	// ═══════════════════════════════════════════════════════════════════════
	{
		Key:   "operation",
		Label: "运营配置",
		Children: []PermissionNode{
			{
				Key:   "operation.app",
				Label: "应用管理",
				Children: []PermissionNode{
					{Key: OperationAppList, Label: "列表数据"},
					{Key: OperationAppAdd, Label: "新增"},
					{Key: OperationAppEdit, Label: "编辑"},
							},
			},
			{
				Key:   "operation.subs",
				Label: "订阅配置",
				Children: []PermissionNode{
					{Key: OperationSubsList, Label: "列表数据"},
					{Key: OperationSubsAdd, Label: "新增"},
					{Key: OperationSubsEdit, Label: "编辑"},
					{Key: OperationSubsDelete, Label: "删除"},
				},
			},
			{
				Key:   "operation.payment",
				Label: "支付配置",
				Children: []PermissionNode{
					{Key: OperationPaymentList, Label: "列表数据"},
					{Key: OperationPaymentAdd, Label: "新增"},
					{Key: OperationPaymentEdit, Label: "编辑"},
					{Key: OperationPaymentDelete, Label: "删除"},
				},
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════
	// 用户管理
	// ═══════════════════════════════════════════════════════════════════════
	{
		Key:   "user",
		Label: "用户管理",
		Children: []PermissionNode{
			{
				Key:   "user.appuser",
				Label: "用户管理",
				Children: []PermissionNode{
					{Key: UserAppUserList, Label: "列表数据"},
					{Key: UserAppUserEdit, Label: "编辑"},
				},
			},
			{
				Key:   "user.asset",
				Label: "资产配置",
				Children: []PermissionNode{
					{Key: UserAssetList, Label: "列表数据"},
					{Key: UserAssetEdit, Label: "编辑"},
				},
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════
	// 系统管理
	// ═══════════════════════════════════════════════════════════════════════
	{
		Key:   "system",
		Label: "系统管理",
		Children: []PermissionNode{
			{
				Key:   "system.user",
				Label: "用户管理",
				Children: []PermissionNode{
					{Key: SystemUserList, Label: "列表数据"},
					{Key: SystemUserAdd, Label: "新增"},
					{Key: SystemUserEdit, Label: "编辑"},
				},
			},
			{
				Key:   "system.role",
				Label: "角色管理",
				Children: []PermissionNode{
					{Key: SystemRoleList, Label: "列表数据"},
					{Key: SystemRoleAdd, Label: "新增"},
					{Key: SystemRoleEdit, Label: "编辑"},
				},
			},
		},
	},
}

// AllLeafKeys 递归收集权限树中所有叶子节点的 key。启动时用来同步超管权限。
func AllLeafKeys() []string {
	var keys []string
	var walk func(nodes []PermissionNode)
	walk = func(nodes []PermissionNode) {
		for _, n := range nodes {
			if len(n.Children) == 0 {
				keys = append(keys, n.Key)
			} else {
				walk(n.Children)
			}
		}
	}
	walk(PermissionTree)
	return keys
}
