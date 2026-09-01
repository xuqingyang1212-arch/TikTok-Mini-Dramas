# 数据库初始化策略

## 当前做法（演示项目）

本项目统一采用一种轻量方案，避免同时维护两套表结构：

- **Schema（表结构）**：由 `backend/internal/model/db.go` 中的 `DB.AutoMigrate(...)` 在服务启动时自动维护。
- **Seed（初始化数据）**：`001_init.up.sql` 只负责建库、默认角色以及默认管理员账号。
- `migrations/` 不再存放业务表结构的增量 DDL；模型字段和 GORM Tag 是唯一表结构来源。

首次初始化：

```bash
# 1. 启动后端一次，让 AutoMigrate 创建表
cd backend
cp config.yaml.example config.yaml # 按需修改 DSN
go run ./cmd/server

# 2. 另开终端导入默认管理员数据
mysql -u<user> -p<password> < migrations/001_init.up.sql
```

本方案适合当前不会正式上线、可以接受启动时自动补充字段和索引的演示环境。若数据库结构出现不兼容变化，直接重建演示数据库比维护回滚迁移更简单。


## 后续如需正式上线

如果未来需要多环境发布、审计或回滚，再切换为 `golang-migrate`：

1. 从当前 GORM 模型生成一份完整 schema baseline。
2. 禁用启动时 `AutoMigrate`。
3. 后续每次结构变更只新增成对的 `.up.sql` / `.down.sql`。
4. 在部署流程中执行 migration。

正式切换前不要同时让 AutoMigrate 和版本化 DDL 修改同一结构。

## UTC 时间迁移

项目业务时间统一使用 MySQL `DATETIME(3)` 保存 UTC，Go 连接固定使用 `loc=UTC`，并将 MySQL 会话时区设为 `+00:00`。

历史数据库曾保存 UTC+8 墙上时间。后端启动时会在 `data_migrations` 表检查唯一标记 `20260831_convert_legacy_utc8_to_utc`：

- 未执行时，在同一事务内将 13 张业务表的 30 个时间字段统一减 8 小时；
- `NULL` 时间保持 `NULL`；
- 成功后写入唯一标记，后续启动不会重复转换；
- 任一更新失败时整个事务回滚。

首次在旧数据库部署前必须停止所有写入并执行完整备份：

```bash
mysqldump -h 127.0.0.1 -u root --single-transaction --routines --triggers \
  tiktok_mini_drama > tiktok_mini_drama-before-utc.sql
```

备份完成后再启动新版后端。新建的空数据库也会写入迁移标记，但不会产生数据变换。
