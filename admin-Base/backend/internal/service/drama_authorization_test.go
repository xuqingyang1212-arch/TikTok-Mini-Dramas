package service

import (
	"testing"

	"scaffold-admin/internal/model"
)

func TestAuthorizationStatusForResult(t *testing.T) {
	tests := []struct {
		name      string
		adding    bool
		succeeded bool
		want      string
	}{
		{name: "add succeeds", adding: true, succeeded: true, want: model.DramaAuthorizationAuthorized},
		{name: "add fails", adding: true, succeeded: false, want: model.DramaAuthorizationUnauthorized},
		{name: "remove succeeds", adding: false, succeeded: true, want: model.DramaAuthorizationUnauthorized},
		{name: "remove fails", adding: false, succeeded: false, want: model.DramaAuthorizationAuthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := authorizationStatusForResult(test.adding, test.succeeded); got != test.want {
				t.Fatalf("authorizationStatusForResult(%v, %v) = %q, want %q", test.adding, test.succeeded, got, test.want)
			}
		})
	}
}
