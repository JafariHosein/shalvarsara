package repository

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestLikePattern(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty query matches everything wrapped", "", "%%"},
		{"plain word", "shalvar", "%shalvar%"},
		{"word with a space", "slim fit", "%slim fit%"},
		{"percent is escaped", "%", `%\%%`},
		{"a percent inside a word", "50%off", `%50\%off%`},
		{"underscore is escaped", "_", `%\_%`},
		{"an underscore inside a word", "slim_fit", `%slim\_fit%`},
		{"backslash is escaped", `\`, `%\\%`},
		{"backslash before a percent", `\%`, `%\\\%%`},
		{"all metacharacters together", `%_\`, `%\%\_\\%`},
		// A phone number search is the realistic case for an underscore-free,
		// percent-free query.
		{"phone search", "0912", "%0912%"},
		{"order code search", "SS-1405-0001", "%SS-1405-0001%"},
		{"persian query is passed through", "\u0634\u0644\u0648\u0627\u0631", "%\u0634\u0644\u0648\u0627\u0631%"},
		{"a dash is not a metacharacter", "a-b", "%a-b%"},
		{"multiple wildcards are all escaped", "%%%", `%\%\%\%%`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := likePattern(tt.in); got != tt.want {
				t.Fatalf("likePattern(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// Every pattern is used in an ILIKE with ESCAPE '\', so the wrapping and the
// escaping must hold for any input.
func TestLikePatternAlwaysWrapsAndEscapes(t *testing.T) {
	inputs := []string{
		"", "a", "%", "_", `\`, "%%__\\\\", "normal query", "\u0634\u0644\u0648\u0627\u0631",
	}

	for _, in := range inputs {
		t.Run(in, func(t *testing.T) {
			got := likePattern(in)

			if len(got) < 2 || got[0] != '%' || got[len(got)-1] != '%' {
				t.Fatalf("likePattern(%q) = %q, want it wrapped in %%...%%", in, got)
			}

			// Walk the pattern and confirm no metacharacter is left bare: every
			// %, _ and \ must be preceded by an odd run of backslashes.
			body := got[1 : len(got)-1]
			backslashes := 0
			for i := 0; i < len(body); i++ {
				switch body[i] {
				case '\\':
					backslashes++
					continue
				case '%', '_':
					if backslashes%2 == 0 {
						t.Fatalf("likePattern(%q) = %q, leaves %q unescaped at index %d", in, got, body[i], i)
					}
				}
				backslashes = 0
			}
		})
	}
}

func TestIsUniqueViolation(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"a unique violation", &pgconn.PgError{Code: "23505"}, true},
		{"a unique violation wrapped", fmt.Errorf("insert user: %w", &pgconn.PgError{Code: "23505"}), true},
		{"a foreign key violation", &pgconn.PgError{Code: "23503"}, false},
		{"a check violation", &pgconn.PgError{Code: "23514"}, false},
		{"an invalid text representation", &pgconn.PgError{Code: "22P02"}, false},
		{"nil", nil, false},
		{"a plain error", errors.New("boom"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isUniqueViolation(tt.err); got != tt.want {
				t.Fatalf("isUniqueViolation(%v) = %v, want %v", tt.err, got, tt.want)
			}
		})
	}
}

func TestOtherViolationHelpers(t *testing.T) {
	unique := &pgconn.PgError{Code: "23505"}
	foreignKey := &pgconn.PgError{Code: "23503"}
	check := &pgconn.PgError{Code: "23514"}
	invalidText := &pgconn.PgError{Code: "22P02"}

	tests := []struct {
		name       string
		err        error
		wantFK     bool
		wantCheck  bool
		wantInvTxt bool
	}{
		{"foreign key", foreignKey, true, false, false},
		{"check", check, false, true, false},
		{"invalid text representation", invalidText, false, false, true},
		{"unique", unique, false, false, false},
		{"wrapped check", fmt.Errorf("cast: %w", check), false, true, false},
		{"nil", nil, false, false, false},
		{"plain error", errors.New("boom"), false, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isForeignKeyViolation(tt.err); got != tt.wantFK {
				t.Errorf("isForeignKeyViolation(%v) = %v, want %v", tt.err, got, tt.wantFK)
			}
			if got := isCheckViolation(tt.err); got != tt.wantCheck {
				t.Errorf("isCheckViolation(%v) = %v, want %v", tt.err, got, tt.wantCheck)
			}
			if got := isInvalidTextRepresentation(tt.err); got != tt.wantInvTxt {
				t.Errorf("isInvalidTextRepresentation(%v) = %v, want %v", tt.err, got, tt.wantInvTxt)
			}
		})
	}
}
