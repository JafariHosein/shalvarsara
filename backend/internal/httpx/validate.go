package httpx

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/model"
)

// validate is a shared, concurrency-safe validator instance.
var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())

	// Report field names as the JSON tag so API consumers can map errors back to
	// their form inputs.
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "" || name == "-" {
			return fld.Name
		}
		return name
	})
	return v
}

// ValidationError carries per-field messages; the response layer turns it into a
// 422 with a `details` object.
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "validation failed" }

// Unwrap lets errors.Is(err, model.ErrValidation) succeed.
func (e *ValidationError) Unwrap() error { return model.ErrValidation }

// Bind parses a JSON body and validates it.
func Bind(c *fiber.Ctx, dst any) error {
	if err := c.BodyParser(dst); err != nil {
		return model.ErrValidation
	}
	return ValidateStruct(dst)
}

// ValidateStruct validates a struct and returns a *ValidationError on failure.
func ValidateStruct(dst any) error {
	err := validate.Struct(dst)
	if err == nil {
		return nil
	}

	fields := map[string]string{}
	if verrs, ok := err.(validator.ValidationErrors); ok {
		for _, fe := range verrs {
			fields[fe.Field()] = persianMessage(fe)
		}
	} else {
		fields["_"] = "داده‌های ورودی نامعتبر است."
	}
	return &ValidationError{Fields: fields}
}

// persianMessage turns a validator tag into a short Persian message.
func persianMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "این فیلد الزامی است."
	case "email":
		return "ایمیل معتبر نیست."
	case "url":
		return "نشانی معتبر نیست."
	case "min":
		return "مقدار واردشده کوتاه است."
	case "max":
		return "مقدار واردشده بیش از حد مجاز است."
	case "len":
		return "طول مقدار واردشده درست نیست."
	case "numeric":
		return "فقط رقم وارد کنید."
	case "gte":
		return "مقدار واردشده کمتر از حد مجاز است."
	case "lte":
		return "مقدار واردشده بیشتر از حد مجاز است."
	case "gt":
		return "مقدار واردشده باید بزرگ‌تر باشد."
	case "oneof":
		return "مقدار واردشده مجاز نیست."
	default:
		return "مقدار واردشده نامعتبر است."
	}
}
