package model

import "testing"

func TestNewPage(t *testing.T) {
	items := []string{"a", "b"}

	tests := []struct {
		name           string
		page           int
		limit          int
		total          int64
		wantPage       int
		wantLimit      int
		wantTotalPages int
	}{
		{"exact division", 1, 20, 40, 1, 20, 2},
		{"rounds up a partial page", 1, 20, 41, 1, 20, 3},
		{"single item is one page", 1, 20, 1, 1, 20, 1},
		{"zero total means zero pages", 1, 20, 0, 1, 20, 0},
		{"negative total means zero pages", 1, 20, -5, 1, 20, 0},
		{"limit one", 1, 1, 7, 1, 1, 7},
		{"total just over a limit", 1, 50, 51, 1, 50, 2},
		{"large total", 1, 20, 1_000_000, 1, 20, 50_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewPage(items, tt.page, tt.limit, tt.total)

			if got.Page != tt.wantPage {
				t.Errorf("Page = %d, want %d", got.Page, tt.wantPage)
			}
			if got.Limit != tt.wantLimit {
				t.Errorf("Limit = %d, want %d", got.Limit, tt.wantLimit)
			}
			if got.Total != tt.total {
				t.Errorf("Total = %d, want %d", got.Total, tt.total)
			}
			if got.TotalPages != tt.wantTotalPages {
				t.Errorf("TotalPages = %d, want %d", got.TotalPages, tt.wantTotalPages)
			}
			if len(got.Items) != len(items) {
				t.Errorf("len(Items) = %d, want %d", len(got.Items), len(items))
			}
		})
	}
}

func TestNewPageClamping(t *testing.T) {
	tests := []struct {
		name          string
		page          int
		limit         int
		total         int64
		wantPage      int
		wantLimit     int
		wantTotalPage int
	}{
		{"page zero becomes one", 0, 20, 100, 1, 20, 5},
		{"negative page becomes one", -3, 20, 100, 1, 20, 5},
		{"limit zero becomes the default 20", 1, 0, 100, 1, 20, 5},
		{"negative limit becomes the default 20", 1, -10, 100, 1, 20, 5},
		{"both clamped at once", 0, 0, 100, 1, 20, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewPage([]string{}, tt.page, tt.limit, tt.total)

			if got.Page != tt.wantPage {
				t.Fatalf("Page = %d, want %d", got.Page, tt.wantPage)
			}
			if got.Limit != tt.wantLimit {
				t.Fatalf("Limit = %d, want %d", got.Limit, tt.wantLimit)
			}
			// TotalPages is computed from the clamped limit, never the input.
			if got.TotalPages != tt.wantTotalPage {
				t.Fatalf("TotalPages = %d, want %d", got.TotalPages, tt.wantTotalPage)
			}
		})
	}
}

func TestNewPageNilItems(t *testing.T) {
	got := NewPage[string](nil, 1, 20, 0)

	// nil marshals as JSON null, which would break every list endpoint.
	if got.Items == nil {
		t.Fatal("Items is nil, want a non-nil empty slice")
	}
	if len(got.Items) != 0 {
		t.Fatalf("len(Items) = %d, want 0", len(got.Items))
	}
}

// NewPage is generic; confirm it works for a concrete domain type too.
func TestNewPageOfProducts(t *testing.T) {
	got := NewPage([]Product{{ID: 1, Title: "شلوار"}, {ID: 2}}, 2, 1, 5)

	if len(got.Items) != 2 {
		t.Fatalf("len(Items) = %d, want 2", len(got.Items))
	}
	if got.Items[0].Title != "شلوار" {
		t.Fatalf("Items[0].Title = %q, want %q", got.Items[0].Title, "شلوار")
	}
	if got.Page != 2 || got.Limit != 1 || got.TotalPages != 5 {
		t.Fatalf("page envelope = (%d, %d, %d), want (2, 1, 5)", got.Page, got.Limit, got.TotalPages)
	}
}
