// Package zarinpal is a minimal client for the ZarinPal payment gateway.
//
// It speaks the v4 JSON API and follows the configured environment: with
// Sandbox set (the default) every call goes to sandbox.zarinpal.com, so
// development can never move real money. Amounts here are always Rial — the
// Toman -> Rial conversion happens once, in the payment service.
package zarinpal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/shalvarsara/backend/internal/config"
)

// Gateway codes we act on. Every other code is a failure.
const (
	// CodeSuccess means the request was accepted or the payment verified.
	CodeSuccess = 100
	// CodeVerified means verify ran on a transaction that was already verified.
	// It is a success, not an error: a customer who reloads the callback page
	// must not be told their payment failed.
	CodeVerified = 101
)

// maxBodyBytes caps how much of a gateway response we read.
const maxBodyBytes = 1 << 20

// Client talks to the gateway. One instance is safe for concurrent use.
type Client struct {
	cfg  config.ZarinPalConfig
	http *http.Client
}

// New builds a client from configuration.
func New(cfg config.ZarinPalConfig) *Client {
	return &Client{
		cfg: cfg,
		http: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// Sandbox reports whether the client is pointed at the test service.
func (c *Client) Sandbox() bool { return c.cfg.Sandbox }

// StartPayURL is the page a customer is sent to in order to pay.
func (c *Client) StartPayURL(authority string) string { return c.cfg.StartPayURL(authority) }

// RequestInput describes one payment session to open.
type RequestInput struct {
	// AmountRial is the charge in Rial, as required by the gateway.
	AmountRial  int64
	CallbackURL string
	Description string
	Mobile      string
	Email       string
	OrderCode   string
}

// Request opens a payment session and returns its authority.
func (c *Client) Request(ctx context.Context, in RequestInput) (string, error) {
	payload := requestPayload{
		MerchantID:  c.cfg.MerchantID,
		Amount:      in.AmountRial,
		CallbackURL: in.CallbackURL,
		Description: in.Description,
	}
	if in.Mobile != "" || in.Email != "" || in.OrderCode != "" {
		payload.Metadata = &requestMetadata{
			Mobile:  in.Mobile,
			Email:   in.Email,
			OrderID: in.OrderCode,
		}
	}

	raw, err := c.post(ctx, "/pg/v4/payment/request.json", payload)
	if err != nil {
		return "", err
	}

	var result struct {
		Code      int    `json:"code"`
		Message   string `json:"message"`
		Authority string `json:"authority"`
	}
	if err := decode(raw, &result); err != nil {
		return "", err
	}
	if result.Code != CodeSuccess || result.Authority == "" {
		return "", &Error{Code: result.Code, Message: result.Message}
	}
	return result.Authority, nil
}

// VerifyResult is what the gateway reports about a session.
type VerifyResult struct {
	// Code is the raw gateway code: CodeSuccess or CodeVerified on success.
	Code    int
	RefID   string
	CardPan string
}

// OK reports whether the code means the money was taken.
func (r VerifyResult) OK() bool {
	return r.Code == CodeSuccess || r.Code == CodeVerified
}

// Verify confirms a payment. The amount must match the one requested, otherwise
// the gateway refuses with code -50: that check is what stops a tampered amount
// from marking an order paid.
func (c *Client) Verify(ctx context.Context, authority string, amountRial int64) (VerifyResult, error) {
	payload := verifyPayload{
		MerchantID: c.cfg.MerchantID,
		Amount:     amountRial,
		Authority:  authority,
	}

	raw, err := c.post(ctx, "/pg/v4/payment/verify.json", payload)
	if err != nil {
		return VerifyResult{}, err
	}

	var result struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		RefID   json.RawMessage `json:"ref_id"`
		CardPan string          `json:"card_pan"`
	}
	if err := decode(raw, &result); err != nil {
		return VerifyResult{}, err
	}
	if !(VerifyResult{Code: result.Code}).OK() {
		return VerifyResult{}, &Error{Code: result.Code, Message: result.Message}
	}
	return VerifyResult{Code: result.Code, RefID: refIDString(result.RefID), CardPan: result.CardPan}, nil
}

// ------------------------------------------------------------------ types ----

type requestPayload struct {
	MerchantID  string           `json:"merchant_id"`
	Amount      int64            `json:"amount"`
	CallbackURL string           `json:"callback_url"`
	Description string           `json:"description"`
	Metadata    *requestMetadata `json:"metadata,omitempty"`
}

type requestMetadata struct {
	Mobile  string `json:"mobile,omitempty"`
	Email   string `json:"email,omitempty"`
	OrderID string `json:"order_id,omitempty"`
}

type verifyPayload struct {
	MerchantID string `json:"merchant_id"`
	Amount     int64  `json:"amount"`
	Authority  string `json:"authority"`
}

// envelope is the shape every v4 method answers with. Data is kept raw because
// the gateway sends an empty array instead of an object when a call fails.
type envelope struct {
	Data   json.RawMessage `json:"data"`
	Errors []Error         `json:"errors"`
}

// Error is a failure reported by the gateway. Code is the numeric ZarinPal code.
type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string {
	return "zarinpal: code " + strconv.Itoa(e.Code) + ": " + e.Message
}

// Persian renders the code as a message a customer can act on.
func (e *Error) Persian() string {
	switch e.Code {
	case -9:
		return "اطلاعات ارسالی به درگاه پرداخت نامعتبر است."
	case -10, -11:
		return "درگاه پرداخت در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید."
	case -12:
		return "تعداد تلاش‌های شما برای پرداخت بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
	case -13, -16, -17, -19:
		return "امکان پرداخت برای این فروشگاه در حال حاضر فراهم نیست."
	case -14:
		return "آدرس بازگشت با دامنهٔ ثبت‌شدهٔ درگاه هم‌خوانی ندارد."
	case -15:
		return "درگاه پرداخت این فروشگاه موقتاً غیرفعال است."
	case -40, -41:
		return "مبلغ این سفارش برای پرداخت در درگاه مجاز نیست."
	case -50:
		return "مبلغ پرداخت‌شده با مبلغ سفارش هم‌خوانی ندارد."
	case -51:
		return "پرداخت ناموفق بود یا توسط شما لغو شد."
	case -52:
		return "خطای غیرمنتظره‌ای در درگاه پرداخت رخ داد."
	case -53, -54:
		return "اطلاعات این تراکنش برای درگاه پرداخت معتبر نیست."
	case -55:
		return "تراکنش مورد نظر در درگاه پرداخت یافت نشد."
	}
	if msg := strings.TrimSpace(e.Message); msg != "" {
		return "خطا در ارتباط با درگاه پرداخت: " + msg
	}
	return "خطا در ارتباط با درگاه پرداخت."
}

// ------------------------------------------------------------- transport ----

// post calls one gateway method and returns its data member.
func (c *Client) post(ctx context.Context, path string, payload any) (json.RawMessage, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("zarinpal: encode %s: %w", path, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL()+path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("zarinpal: build %s: %w", path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("zarinpal: call %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("zarinpal: read %s: %w", path, err)
	}

	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("zarinpal: %s: unexpected response (http %d)", path, resp.StatusCode)
	}
	if len(env.Errors) > 0 {
		return nil, &env.Errors[0]
	}
	return env.Data, nil
}

// decode unmarshals the data member. The gateway answers with an empty array
// instead of an object when a call fails, and that must surface as a gateway
// error rather than as a JSON decoding failure the caller cannot act on.
func decode(raw json.RawMessage, dst any) error {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return &Error{Code: -1, Message: "the gateway returned no data"}
	}
	if err := json.Unmarshal(trimmed, dst); err != nil {
		return fmt.Errorf("zarinpal: decode data: %w", err)
	}
	return nil
}

// refIDString renders ref_id, which the gateway sends as either a number or a
// string depending on the method.
func refIDString(raw json.RawMessage) string {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return ""
	}
	var asString string
	if err := json.Unmarshal(trimmed, &asString); err == nil {
		return asString
	}
	return string(bytes.Trim(trimmed, `"`))
}
