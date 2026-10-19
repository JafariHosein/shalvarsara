package service

import (
	"testing"

	"github.com/shalvarsara/backend/internal/model"
)

func TestOrderStatusFa(t *testing.T) {
	tests := []struct {
		name   string
		status string
		want   string
	}{
		{"pending", model.OrderPending, "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A"},
		{"paid", model.OrderPaid, "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647"},
		{"processing", model.OrderProcessing, "\u062F\u0631 \u062D\u0627\u0644 \u067E\u0631\u062F\u0627\u0632\u0634"},
		{"shipped", model.OrderShipped, "\u0627\u0631\u0633\u0627\u0644\u200C\u0634\u062F\u0647"},
		{"delivered", model.OrderDelivered, "\u062A\u062D\u0648\u06CC\u0644\u200C\u0634\u062F\u0647"},
		{"canceled", model.OrderCanceled, "\u0644\u063A\u0648\u0634\u062F\u0647"},
		// Unknown statuses fall through as-is so a new enum member is at least
		// visible to the customer instead of showing an empty label.
		{"unknown status echoes the input", "refunded", "refunded"},
		{"empty status echoes the input", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := orderStatusFa(tt.status); got != tt.want {
				t.Fatalf("orderStatusFa(%q) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}

// Every status the model knows must have its own label; a missing case would
// leak the raw English enum value into the customer's message.
func TestOrderStatusFaCoversEveryStatus(t *testing.T) {
	seen := make(map[string]string, len(model.OrderStatuses))

	for _, status := range model.OrderStatuses {
		label := orderStatusFa(status)
		if label == "" {
			t.Fatalf("orderStatusFa(%q) is empty, want a Persian label", status)
		}
		if label == status {
			t.Fatalf("orderStatusFa(%q) returned the raw status, want a Persian label", status)
		}
		if prev, ok := seen[label]; ok {
			t.Fatalf("orderStatusFa(%q) and orderStatusFa(%q) share the label %q", prev, status, label)
		}
		seen[label] = status
	}
}
