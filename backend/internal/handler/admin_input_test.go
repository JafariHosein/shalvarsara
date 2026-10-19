package handler

import (
	"testing"

	"github.com/shalvarsara/backend/internal/httpx"
	"github.com/shalvarsara/backend/internal/model"
)

// The admin PATCH inputs are pointer-based so a partial update cannot zero the
// fields it did not send. These tests pin the two halves of that contract:
// a nil pointer must be skipped by the validator (there is nothing to check),
// and a present pointer must still be checked against its rules.
func TestAdminVariantInputValidation(t *testing.T) {
	str := func(s string) *string { return &s }
	i32 := func(n int32) *int32 { return &n }
	i64 := func(n int64) *int64 { return &n }

	tests := []struct {
		name    string
		in      model.AdminVariantInput
		wantErr bool
	}{
		{name: "all nil is a no-op patch", in: model.AdminVariantInput{}},
		{
			name: "only stock is a valid patch",
			in:   model.AdminVariantInput{Stock: i32(5)},
		},
		{
			name: "only isPrimary-style single field",
			in:   model.AdminVariantInput{SKU: str("SS-1")},
		},
		{
			name: "full create payload",
			in: model.AdminVariantInput{
				Size: str("32"), Color: str("مشکی"), ColorHex: str("#111111"),
				Stock: i32(3), SKU: str("SS-1-32"), ExtraPrice: i64(50000),
			},
		},
		{
			name:    "present but empty size fails min=1",
			in:      model.AdminVariantInput{Size: str("")},
			wantErr: true,
		},
		{
			name:    "negative stock fails gte=0",
			in:      model.AdminVariantInput{Stock: i32(-1)},
			wantErr: true,
		},
		{
			name:    "negative extra price fails gte=0",
			in:      model.AdminVariantInput{ExtraPrice: i64(-1)},
			wantErr: true,
		},
		{
			name:    "over-long size fails max=20",
			in:      model.AdminVariantInput{Size: str("123456789012345678901")},
			wantErr: true,
		},
		{
			// A zero is a real, writable value: setting stock to 0 takes the
			// size off sale on purpose, so it must not be mistaken for "absent".
			name: "explicit zero stock is valid",
			in:   model.AdminVariantInput{Stock: i32(0)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := httpx.ValidateStruct(&tt.in)
			if tt.wantErr && err == nil {
				t.Fatalf("ValidateStruct(%+v) = nil, want a validation error", tt.in)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("ValidateStruct(%+v) returned an unexpected error: %v", tt.in, err)
			}
		})
	}
}

func TestAdminImageInputValidation(t *testing.T) {
	str := func(s string) *string { return &s }
	b := func(v bool) *bool { return &v }
	i32 := func(n int32) *int32 { return &n }

	tests := []struct {
		name    string
		in      model.AdminImageInput
		wantErr bool
	}{
		{name: "all nil is a no-op patch", in: model.AdminImageInput{}},
		{
			// This is the "make primary" click: one field, nothing else.
			name: "promote to primary only",
			in:   model.AdminImageInput{IsPrimary: b(true)},
		},
		{
			// A relative path is what the seeded catalogue actually stores; the
			// old `required,url` tag rejected all 186 of them.
			name: "relative path is accepted",
			in:   model.AdminImageInput{URL: str("/products/cotton-gray-a-2.webp")},
		},
		{
			name: "absolute url is accepted",
			in:   model.AdminImageInput{URL: str("https://cdn.example.com/a.webp")},
		},
		{
			name:    "over-long url fails max=500",
			in:      model.AdminImageInput{URL: str(string(make([]byte, 501)))},
			wantErr: true,
		},
		{
			name:    "demoting to not-primary is valid",
			in:      model.AdminImageInput{IsPrimary: b(false)},
			wantErr: false,
		},
		{
			name: "explicit zero sort order is valid",
			in:   model.AdminImageInput{SortOrder: i32(0)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := httpx.ValidateStruct(&tt.in)
			if tt.wantErr && err == nil {
				t.Fatalf("ValidateStruct(%+v) = nil, want a validation error", tt.in)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("ValidateStruct(%+v) returned an unexpected error: %v", tt.in, err)
			}
		})
	}
}
