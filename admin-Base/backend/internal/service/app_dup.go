package service

import "strings"

// classifyAppDuplicate 区分是 app_id 还是 client_key 触发的唯一约束冲突
func classifyAppDuplicate(err error) error {
	if err != nil && strings.Contains(err.Error(), "app_id") {
		return ErrAppAppIDExists
	}
	return ErrAppClientKeyExists
}
