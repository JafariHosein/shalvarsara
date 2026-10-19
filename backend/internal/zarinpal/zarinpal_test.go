package zarinpal

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestErrorPersian(t *testing.T) {
	tests := []struct {
		name string
		code int
		msg  string
		want string
	}{
		{
			name: "code -9 invalid input",
			code: -9,
			want: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0631\u0633\u0627\u0644\u06CC \u0628\u0647 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.",
		},
		{
			name: "code -10 gateway unavailable",
			code: -10,
			want: "\u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u06A9\u0645\u06CC \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646\u06CC\u062F.",
		},
		{
			name: "code -14 callback mismatch",
			code: -14,
			want: "\u0622\u062F\u0631\u0633 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0627 \u062F\u0627\u0645\u0646\u0647\u0654 \u062B\u0628\u062A\u200C\u0634\u062F\u0647\u0654 \u062F\u0631\u06AF\u0627\u0647 \u0647\u0645\u200C\u062E\u0648\u0627\u0646\u06CC \u0646\u062F\u0627\u0631\u062F.",
		},
		{
			name: "code -50 amount mismatch",
			code: -50,
			want: "\u0645\u0628\u0644\u063A \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647 \u0628\u0627 \u0645\u0628\u0644\u063A \u0633\u0641\u0627\u0631\u0634 \u0647\u0645\u200C\u062E\u0648\u0627\u0646\u06CC \u0646\u062F\u0627\u0631\u062F.",
		},
		{
			name: "code -51 failed or cancelled",
			code: -51,
			want: "\u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F \u06CC\u0627 \u062A\u0648\u0633\u0637 \u0634\u0645\u0627 \u0644\u063A\u0648 \u0634\u062F.",
		},
		{
			name: "code -55 transaction not found",
			code: -55,
			want: "\u062A\u0631\u0627\u06A9\u0646\u0634 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.",
		},
		{
			// An unknown code with a gateway message must pass that message on,
			// because it is the only actionable information available.
			name: "unknown code with a message",
			code: -777,
			msg:  "some gateway detail",
			want: "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A: some gateway detail",
		},
		{
			name: "unknown code without a message",
			code: -777,
			want: "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A.",
		},
		{
			name: "unknown code with a blank message",
			code: -777,
			msg:  "   ",
			want: "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A.",
		},
		{
			// A known code wins over whatever message came with it, so a
			// gateway that answers in English still shows Persian.
			name: "known code ignores the message",
			code: -55,
			msg:  "Transaction not found",
			want: "\u062A\u0631\u0627\u06A9\u0646\u0634 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u062F\u0631\u06AF\u0627\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := &Error{Code: tt.code, Message: tt.msg}
			if got := e.Persian(); got != tt.want {
				t.Fatalf("Persian() for code %d = %q, want %q", tt.code, got, tt.want)
			}
		})
	}
}

// A nil receiver must not panic: the payment service builds these from a
// decoded envelope and renders them on the error path.
func TestErrorError(t *testing.T) {
	e := &Error{Code: -50, Message: "amount mismatch"}
	want := "zarinpal: code -50: amount mismatch"
	if got := e.Error(); got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}
}

func TestVerifyResultOK(t *testing.T) {
	tests := []struct {
		name string
		code int
		want bool
	}{
		{"success", CodeSuccess, true},
		{"already verified", CodeVerified, true},
		{"zero", 0, false},
		{"negative failure code", -50, false},
		{"another positive code", 102, false},
		{"ninety-nine", 99, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := VerifyResult{Code: tt.code}
			if got := r.OK(); got != tt.want {
				t.Fatalf("OK() for code %d = %v, want %v", tt.code, got, tt.want)
			}
		})
	}

	// The constants themselves are part of the gateway contract.
	if CodeSuccess != 100 || CodeVerified != 101 {
		t.Fatalf("gateway code constants changed: CodeSuccess = %d, CodeVerified = %d", CodeSuccess, CodeVerified)
	}
}

func TestRefIDString(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{"number", "123456789", "123456789"},
		{"quoted number", `"123456789"`, "123456789"},
		{"zero", "0", "0"},
		{"quoted zero", `"0"`, "0"},
		{"null", "null", ""},
		{"null with padding", "  null  ", ""},
		{"empty", "", ""},
		{"whitespace", "   ", ""},
		{"non-numeric string", `"abc-def"`, "abc-def"},
		{"empty string", `""`, ""},
		{"large number", "999999999999999", "999999999999999"},
		{"number with padding", "  42  ", "42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := json.RawMessage(tt.raw)
			if got := refIDString(raw); got != tt.want {
				t.Fatalf("refIDString(%s) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestDecode(t *testing.T) {
	t.Run("an object decodes", func(t *testing.T) {
		var dst struct {
			Code int `json:"code"`
		}
		raw := json.RawMessage(`{"code":100}`)

		if err := decode(raw, &dst); err != nil {
			t.Fatalf("decode() error = %v, want nil", err)
		}
		if dst.Code != 100 {
			t.Fatalf("decoded code = %d, want 100", dst.Code)
		}
	})

	t.Run("an object with leading whitespace decodes", func(t *testing.T) {
		var dst struct {
			Code int `json:"code"`
		}
		if err := decode(json.RawMessage(" \n\t{\"code\":101}"), &dst); err != nil {
			t.Fatalf("decode() error = %v, want nil", err)
		}
		if dst.Code != 101 {
			t.Fatalf("decoded code = %d, want 101", dst.Code)
		}
	})

	t.Run("an empty array is a gateway error", func(t *testing.T) {
		var dst map[string]any

		err := decode(json.RawMessage("[]"), &dst)
		if err == nil {
			t.Fatal("decode([]) = nil, want a gateway error")
		}

		var gwErr *Error
		if !errors.As(err, &gwErr) {
			t.Fatalf("decode([]) error is %T, want *zarinpal.Error", err)
		}
		if gwErr.Code != -1 {
			t.Fatalf("decode([]) error code = %d, want -1", gwErr.Code)
		}
		// The message is what a support engineer sees, so it must explain the
		// odd shape rather than just "invalid JSON".
		if !strings.Contains(gwErr.Message, "no data") {
			t.Fatalf("decode([]) error message = %q, want it to mention the missing data", gwErr.Message)
		}
	})

	t.Run("an array of objects is a gateway error", func(t *testing.T) {
		var dst map[string]any
		if err := decode(json.RawMessage(`[{"code":100}]`), &dst); err == nil {
			t.Fatal("decode(array) = nil, want a gateway error")
		}
	})

	t.Run("a non-object scalar is a gateway error", func(t *testing.T) {
		for _, raw := range []string{"null", "42", `"text"`, "true"} {
			var dst map[string]any
			err := decode(json.RawMessage(raw), &dst)
			if err == nil {
				t.Fatalf("decode(%s) = nil, want a gateway error", raw)
			}
			var gwErr *Error
			if !errors.As(err, &gwErr) {
				t.Fatalf("decode(%s) error is %T, want *zarinpal.Error", raw, err)
			}
		}
	})

	t.Run("empty input is a gateway error", func(t *testing.T) {
		var dst map[string]any
		if err := decode(json.RawMessage(""), &dst); err == nil {
			t.Fatal("decode(\"\") = nil, want a gateway error")
		}
	})

	t.Run("malformed json is a decoding error", func(t *testing.T) {
		var dst map[string]any

		err := decode(json.RawMessage(`{"code":`), &dst)
		if err == nil {
			t.Fatal("decode(malformed) = nil, want an error")
		}
		// This one is not a gateway code: it is a real decode failure.
		var gwErr *Error
		if errors.As(err, &gwErr) {
			t.Fatalf("decode(malformed) returned a gateway error, want a decode error: %v", err)
		}
	})
}
