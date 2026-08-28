-- Baseline rollback: drops the default admin seed.
-- Note: this does NOT drop tables (GORM AutoMigrate owns DDL today).
-- If you ever switch to pure migrate-based schema management, expand this
-- down script to DROP every table created by AutoMigrate.
--
-- role_permissions 由后端启动时自动同步，回滚时一并清理超管角色的所有权限行。

USE tiktok_mini_drama;

DELETE FROM user_roles
WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@admin.com')
  AND role_id IN (SELECT id FROM roles WHERE name = '超级管理员');

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = '超级管理员');

DELETE FROM roles WHERE name = '超级管理员';
DELETE FROM users WHERE email = 'admin@admin.com';
