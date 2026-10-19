package model

import "testing"

func TestNewCartView(t *testing.T) {
	lines := []CartLine{
		{
			ID: 1, ProductID: 10, Title: "شلوار پارچه‌ای مردانه",
			UnitPrice: 900_000, ListPrice: 1_200_000, Quantity: 2, LineTotal: 1_800_000,
			IsAvailable: true,
		},
		{
			ID: 2, ProductID: 11, Title: "شلوار جین زنانه",
			UnitPrice: 750_000, ListPrice: 750_000, Quantity: 1, LineTotal: 750_000,
			IsAvailable: true,
		},
		{
			// Unavailable lines stay in the totals on purpose: they are rejected
			// at checkout instead of vanishing from the basket silently.
			ID: 3, ProductID: 12, Quantity: 3, LineTotal: 300_000,
			IsAvailable: false,
		},
	}

	view := NewCartView(lines)

	if view == nil {
		t.Fatal("NewCartView returned nil")
	}
	if got, want := view.ItemCount, int32(6); got != want {
		t.Fatalf("ItemCount = %d, want %d", got, want)
	}
	if got, want := view.Subtotal, int64(2_850_000); got != want {
		t.Fatalf("Subtotal = %d, want %d", got, want)
	}
	if len(view.Items) != len(lines) {
		t.Fatalf("len(Items) = %d, want %d", len(view.Items), len(lines))
	}

	// The view must share the caller's slice, not copy or reorder it.
	for i := range lines {
		if view.Items[i].ID != lines[i].ID {
			t.Fatalf("Items[%d].ID = %d, want %d", i, view.Items[i].ID, lines[i].ID)
		}
	}
}

func TestNewCartViewNilLines(t *testing.T) {
	view := NewCartView(nil)

	if view == nil {
		t.Fatal("NewCartView(nil) returned nil")
	}
	// nil would marshal as JSON null; the API contract is an empty array.
	if view.Items == nil {
		t.Fatal("Items is nil, want a non-nil empty slice")
	}
	if len(view.Items) != 0 {
		t.Fatalf("len(Items) = %d, want 0", len(view.Items))
	}
	if view.ItemCount != 0 || view.Subtotal != 0 {
		t.Fatalf("ItemCount/Subtotal = %d/%d, want 0/0", view.ItemCount, view.Subtotal)
	}
}

func TestNewCartViewEmptySlice(t *testing.T) {
	view := NewCartView([]CartLine{})

	if view.Items == nil {
		t.Fatal("Items is nil for an empty input, want a non-nil empty slice")
	}
	if view.Subtotal != 0 {
		t.Fatalf("Subtotal = %d, want 0", view.Subtotal)
	}
}

// A line whose stored LineTotal disagrees with unit price x quantity is still
// summed from LineTotal: it is the snapshot the order will be built from.
func TestNewCartViewSumsLineTotals(t *testing.T) {
	view := NewCartView([]CartLine{
		{UnitPrice: 100, Quantity: 3, LineTotal: 250},
		{UnitPrice: 100, Quantity: 2, LineTotal: 200},
	})

	if got, want := view.Subtotal, int64(450); got != want {
		t.Fatalf("Subtotal = %d, want %d", got, want)
	}
	if got, want := view.ItemCount, int32(5); got != want {
		t.Fatalf("ItemCount = %d, want %d", got, want)
	}
}
