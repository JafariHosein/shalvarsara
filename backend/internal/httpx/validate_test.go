package httpx

import (
	"errors"
	"testing"

	"github.com/shalvarsara/backend/internal/model"
)

// validRequest mirrors the real request structs: a required field, a bounded
// string and a bounded slice, all tagged with JSON names that differ from the
// Go field names so the tag-name mapping is actually exercised.
type validRequest struct {
	Name  string   `json:"name" validate:"required,min=2,max=20"`
	Email string   `json:"email" validate:"required,email"`
	Items []string `json:"items" validate:"required,min=1"`
	Note  string   `json:"note" validate:"omitempty,max=5"`
}

func validPayload() validRequest {
	return validRequest{
		Name:  "shalvar",
		Email: "shop@example.com",
		Items: []string{"a"},
	}
}

func TestValidateStructAcceptsValid(t *testing.T) {
	tests := []struct {
		name string
		in   any
	}{
		{"a full valid request", validPayload()},
		{"an omitted optional field", validRequest{Name: "sh", Email: "a@b.co", Items: []string{"x"}}},
		{"a note at the length limit", validRequest{Name: "sh", Email: "a@b.co", Items: []string{"x"}, Note: "12345"}},
		{"a name at the minimum", validRequest{Name: "ab", Email: "a@b.co", Items: []string{"x"}}},
		{"a name at the maximum", validRequest{Name: "abcdefghijklmnopqrst", Email: "a@b.co", Items: []string{"x"}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateStruct(tt.in); err != nil {
				t.Fatalf("ValidateStruct() = %v, want nil", err)
			}
		})
	}
}

func TestValidateStructRequiredMissing(t *testing.T) {
	in := validRequest{Email: "shop@example.com", Items: []string{"a"}} // Name is empty

	err := ValidateStruct(in)
	if err == nil {
		t.Fatal("ValidateStruct() = nil, want a *ValidationError")
	}

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("error is %T, want *ValidationError", err)
	}
	if !errors.Is(err, model.ErrValidation) {
		t.Fatalf("errors.Is(%v, model.ErrValidation) = false, want true", err)
	}
	if len(ve.Fields) != 1 {
		t.Fatalf("Fields = %v, want exactly one entry", ve.Fields)
	}
	// The key must be the JSON tag, not the Go field name: API consumers map
	// errors back to their form inputs by that name.
	msg, ok := ve.Fields["name"]
	if !ok {
		t.Fatalf("Fields = %v, want a %q key", ve.Fields, "name")
	}
	if _, wrong := ve.Fields["Name"]; wrong {
		t.Fatalf("Fields = %v, must not be keyed by the Go field name", ve.Fields)
	}
	if msg != "\u0627\u06CC\u0646 \u0641\u06CC\u0644\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." {
		t.Fatalf("Fields[name] = %q, want the Persian required message", msg)
	}
	if got := ve.Error(); got != "validation failed" {
		t.Fatalf("Error() = %q, want %q", got, "validation failed")
	}
}

func TestValidateStructMaxLength(t *testing.T) {
	in := validPayload()
	in.Note = "far too long"

	err := ValidateStruct(in)
	if err == nil {
		t.Fatal("ValidateStruct() = nil, want a *ValidationError")
	}

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("error is %T, want *ValidationError", err)
	}
	if len(ve.Fields) != 1 {
		t.Fatalf("Fields = %v, want exactly one entry", ve.Fields)
	}
	msg, ok := ve.Fields["note"]
	if !ok {
		t.Fatalf("Fields = %v, want a %q key", ve.Fields, "note")
	}
	if msg != "\u0645\u0642\u062F\u0627\u0631 \u0648\u0627\u0631\u062F\u0634\u062F\u0647 \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A." {
		t.Fatalf("Fields[note] = %q, want the Persian max message", msg)
	}
}

func TestValidateStructOneof(t *testing.T) {
	type statusRequest struct {
		Status string `json:"status" validate:"required,oneof=pending paid processing shipped delivered canceled"`
	}

	t.Run("an allowed value passes", func(t *testing.T) {
		for _, s := range []string{"pending", "paid", "processing", "shipped", "delivered", "canceled"} {
			if err := ValidateStruct(statusRequest{Status: s}); err != nil {
				t.Fatalf("ValidateStruct(%q) = %v, want nil", s, err)
			}
		}
	})

	t.Run("a rejected value reports the json tag", func(t *testing.T) {
		err := ValidateStruct(statusRequest{Status: "refunded"})

		var ve *ValidationError
		if !errors.As(err, &ve) {
			t.Fatalf("error is %T, want *ValidationError", err)
		}
		if _, ok := ve.Fields["status"]; !ok {
			t.Fatalf("Fields = %v, want a %q key", ve.Fields, "status")
		}
	})
}

// Several failures at once must all be reported, so the form can highlight
// every bad input in one round trip.
func TestValidateStructReportsEveryBadField(t *testing.T) {
	err := ValidateStruct(validRequest{})

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("error is %T, want *ValidationError", err)
	}
	for _, key := range []string{"name", "email", "items"} {
		if _, ok := ve.Fields[key]; !ok {
			t.Errorf("Fields = %v, want a %q key", ve.Fields, key)
		}
	}
}

// A field with no json tag falls back to the Go field name, and a tag of "-"
// is treated as unnamed; both are used by the request structs.
func TestValidateStructFieldNameFallback(t *testing.T) {
	type mixed struct {
		NoTag  string `validate:"required"`
		Hidden string `json:"-" validate:"required"`
	}

	err := ValidateStruct(mixed{})

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("error is %T, want *ValidationError", err)
	}
	if _, ok := ve.Fields["NoTag"]; !ok {
		t.Errorf("Fields = %v, want a %q key for a field without a json tag", ve.Fields, "NoTag")
	}
	if _, ok := ve.Fields["Hidden"]; !ok {
		t.Errorf("Fields = %v, want a %q key for a json:\"-\" field", ve.Fields, "Hidden")
	}
}

// A non-struct argument is not a validation failure the client can fix, but it
// must still come back as a *ValidationError rather than a panic.
func TestValidateStructNonStructArgument(t *testing.T) {
	err := ValidateStruct("not a struct")
	if err == nil {
		t.Fatal("ValidateStruct(string) = nil, want a *ValidationError")
	}

	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("error is %T, want *ValidationError", err)
	}
	if _, ok := ve.Fields["_"]; !ok {
		t.Fatalf("Fields = %v, want a %q key for a non-field failure", ve.Fields, "_")
	}
}

// The same validator instance is shared across requests; concurrent use must
// stay safe, which -race verifies.
func TestValidateStructIsSafeForConcurrentUse(t *testing.T) {
	const goroutines = 16

	done := make(chan error, goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			done <- ValidateStruct(validPayload())
		}()
	}
	for i := 0; i < goroutines; i++ {
		if err := <-done; err != nil {
			t.Fatalf("concurrent ValidateStruct() = %v, want nil", err)
		}
	}
}
