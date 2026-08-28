-- TikTok Mini Dramas · Database Initialization
--
-- 说明：
--   1. 表结构由 GORM AutoMigrate 创建，本脚本只做「建库 + 默认账号/角色」。
--   2. 权限点数据不在这里种入，而是在后端启动时由 service.Role.SyncSuperAdminPermissions
--      以 internal/consts/permissions.go 的 PermissionTree 为准自动补齐。
--      如此新增权限点只需改代码，不必维护 SQL 迁移。
--   3. 首次部署流程：
--        a. 建好 MySQL 账号，修改 backend/config.yaml 的 database 段
--        b. 启动 backend 一次让 AutoMigrate 建好表，然后停掉
--        c. 执行本脚本（`mysql < 001_init.up.sql`）种入默认角色/用户
--        d. 重启 backend，启动时自动把权限点同步到超管角色
--        e. 以 admin@admin.com 登录（本地开发验证码固定 123456，见 auth.go）
--
--   幂等：全部 INSERT 都带 IGNORE / ON DUPLICATE KEY UPDATE，可重复执行。

CREATE DATABASE IF NOT EXISTS tiktok_mini_drama
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE tiktok_mini_drama;

-- ─── 1. 超级管理员 角色 ──────────────────────────────────────────────────────
INSERT INTO roles (name, remark, created_at, updated_at)
VALUES ('超级管理员', '拥有所有权限', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = name;

-- ─── 2. 默认 admin 账号 ──────────────────────────────────────────────────────
INSERT INTO users (name, email, status, created_at, updated_at)
VALUES ('超级管理员', 'admin@admin.com', '启用', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = name;

-- ─── 3. 把 admin 账号关联到 超级管理员 角色 ──────────────────────────────────
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@admin.com' AND r.name = '超级管理员';
