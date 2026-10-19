package model

import "testing"

// TestCanTransition exhaustively pins the fulfilment pipeline: every ordered
// pair of statuses is listed, so loosening a rule (or accidentally re-allowing
// pending -> paid) fails here rather than in production.
func TestCanTransition(t *testing.T) {
	// The pipeline is one-way. Terminal states (delivered, canceled) have no
	// outgoing edge, and a no-op transition is never allowed.
	legal := map[[2]string]bool{
		{OrderPending, OrderCanceled}:    true,
		{OrderPaid, OrderProcessing}:     true,
		{OrderPaid, OrderCanceled}:       true,
		{OrderProcessing, OrderShipped}:  true,
		{OrderProcessing, OrderCanceled}: true,
		{OrderShipped, OrderDelivered}:   true,
	}

	statuses := []string{
		OrderPending, OrderPaid, OrderProcessing, OrderShipped, OrderDelivered, OrderCanceled,
	}

	for _, from := range statuses {
		for _, to := range statuses {
			from, to := from, to
			t.Run(from+"->"+to, func(t *testing.T) {
				want := legal[[2]string{from, to}]
				if got := CanTransition(from, to); got != want {
					t.Fatalf("CanTransition(%q, %q) = %v, want %v", from, to, got, want)
				}
			})
		}
	}
}

// The security-relevant cases spelled out individually, so the intent survives
// any future table edit. An admin must never be able to declare an order paid:
// only the gateway callback may do that.
func TestCanTransitionNamedCases(t *testing.T) {
	tests := []struct {
		name string
		from string
		to   string
		want bool
	}{
		{"pending to paid is not an admin action", OrderPending, OrderPaid, false},
		{"pending to processing must go through paid", OrderPending, OrderProcessing, false},
		{"pending to shipped must go through paid", OrderPending, OrderShipped, false},
		{"pending to delivered must go through paid", OrderPending, OrderDelivered, false},
		{"pending can be cancelled", OrderPending, OrderCanceled, true},

		{"paid to processing", OrderPaid, OrderProcessing, true},
		{"paid can be cancelled (refund path)", OrderPaid, OrderCanceled, true},
		{"paid back to pending is illegal", OrderPaid, OrderPending, false},
		{"paid to shipped skips processing", OrderPaid, OrderShipped, false},

		{"processing to shipped", OrderProcessing, OrderShipped, true},
		{"processing can be cancelled", OrderProcessing, OrderCanceled, true},
		{"processing back to paid is illegal", OrderProcessing, OrderPaid, false},
		{"processing to delivered skips shipping", OrderProcessing, OrderDelivered, false},

		{"shipped to delivered", OrderShipped, OrderDelivered, true},
		{"shipped cannot be cancelled", OrderShipped, OrderCanceled, false},
		{"shipped back to processing is illegal", OrderShipped, OrderProcessing, false},

		{"delivered is terminal", OrderDelivered, OrderPaid, false},
		{"delivered cannot be cancelled", OrderDelivered, OrderCanceled, false},
		{"delivered cannot be shipped again", OrderDelivered, OrderShipped, false},

		{"canceled is terminal", OrderCanceled, OrderPending, false},
		{"canceled cannot be paid", OrderCanceled, OrderPaid, false},
		{"canceled cannot be revived as processing", OrderCanceled, OrderProcessing, false},

		{"same status is never a transition", OrderPending, OrderPending, false},
		{"same terminal status is never a transition", OrderCanceled, OrderCanceled, false},

		{"unknown source status allows nothing", "refunded", OrderPaid, false},
		{"empty source status allows nothing", "", OrderPending, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanTransition(tt.from, tt.to); got != tt.want {
				t.Fatalf("CanTransition(%q, %q) = %v, want %v", tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestValidOrderStatus(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{OrderPending, true},
		{OrderPaid, true},
		{OrderProcessing, true},
		{OrderShipped, true},
		{OrderDelivered, true},
		{OrderCanceled, true},
		{"", false},
		{"Pending", false},
		{"refunded", false},
		{"pending ", false},
		{"all", false},
	}

	for _, tt := range tests {
		t.Run("status="+tt.in, func(t *testing.T) {
			if got := ValidOrderStatus(tt.in); got != tt.want {
				t.Fatalf("ValidOrderStatus(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestValidPaymentStatus(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{PaymentInitiated, true},
		{PaymentVerified, true},
		{PaymentFailed, true},
		{"", false},
		{"Verified", false},
		{"all", false},
		{OrderPaid, false},
	}

	for _, tt := range tests {
		t.Run("status="+tt.in, func(t *testing.T) {
			if got := ValidPaymentStatus(tt.in); got != tt.want {
				t.Fatalf("ValidPaymentStatus(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestValidRole(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{string(RoleCustomer), true},
		{string(RoleAdmin), true},
		{"", false},
		{"Admin", false},
		{"superadmin", false},
		{" customer", false},
	}

	for _, tt := range tests {
		t.Run("role="+tt.in, func(t *testing.T) {
			if got := ValidRole(tt.in); got != tt.want {
				t.Fatalf("ValidRole(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestPointerHelpers(t *testing.T) {
	t.Run("Bool", func(t *testing.T) {
		yes, no := true, false
		tests := []struct {
			name string
			in   *bool
			def  bool
			want bool
		}{
			{"nil falls back to true", nil, true, true},
			{"nil falls back to false", nil, false, false},
			{"pointer beats the fallback", &yes, false, true},
			{"pointer false beats a true fallback", &no, true, false},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if got := Bool(tt.in, tt.def); got != tt.want {
					t.Fatalf("Bool(%v, %v) = %v, want %v", tt.in, tt.def, got, tt.want)
				}
			})
		}
	})

	t.Run("Str", func(t *testing.T) {
		empty := ""
		value := "shalvar"
		tests := []struct {
			name string
			in   *string
			def  string
			want string
		}{
			{"nil falls back", nil, "fallback", "fallback"},
			{"pointer wins", &value, "fallback", "shalvar"},
			{"explicit empty string is not nil", &empty, "fallback", ""},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if got := Str(tt.in, tt.def); got != tt.want {
					t.Fatalf("Str(%v, %q) = %q, want %q", tt.in, tt.def, got, tt.want)
				}
			})
		}
	})

	t.Run("I64", func(t *testing.T) {
		var zero int64
		value := int64(2_000_000)
		tests := []struct {
			name string
			in   *int64
			def  int64
			want int64
		}{
			{"nil falls back", nil, 65_000, 65_000},
			{"pointer wins", &value, 65_000, 2_000_000},
			{"explicit zero is not nil", &zero, 65_000, 0},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if got := I64(tt.in, tt.def); got != tt.want {
					t.Fatalf("I64(%v, %d) = %d, want %d", tt.in, tt.def, got, tt.want)
				}
			})
		}
	})

	t.Run("I32", func(t *testing.T) {
		var zero int32
		value := int32(12)
		tests := []struct {
			name string
			in   *int32
			def  int32
			want int32
		}{
			{"nil falls back", nil, 20, 20},
			{"pointer wins", &value, 20, 12},
			{"explicit zero is not nil", &zero, 20, 0},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if got := I32(tt.in, tt.def); got != tt.want {
					t.Fatalf("I32(%v, %d) = %d, want %d", tt.in, tt.def, got, tt.want)
				}
			})
		}
	})
}
