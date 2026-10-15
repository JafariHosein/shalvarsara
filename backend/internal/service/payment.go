package service

import (
	"context"
	"errors"
	"strings"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
	"github.com/shalvarsara/backend/internal/zarinpal"
)

// rialPerToman is the only place the two currencies meet: everything inside the
// app is Toman, and the gateway is told Rial.
const rialPerToman = 10

// PaymentService drives the ZarinPal flow: open a session for an order, then
// confirm it when the customer comes back.
type PaymentService struct {
	orders   *repository.OrderRepository
	payments *repository.PaymentRepository
	users    *repository.UserRepository
	gateway  *zarinpal.Client
	cfg      config.ZarinPalConfig
}

// NewPaymentService wires the payment service.
func NewPaymentService(
	orders *repository.OrderRepository,
	payments *repository.PaymentRepository,
	users *repository.UserRepository,
	gateway *zarinpal.Client,
	cfg config.ZarinPalConfig,
) *PaymentService {
	return &PaymentService{orders: orders, payments: payments, users: users, gateway: gateway, cfg: cfg}
}

// Start opens a gateway session for one of the user's orders and returns the
// page the browser must be sent to.
//
// The amount is taken from the stored order, never from the request, so a
// tampered client cannot pay one Toman for a two-million-Toman order.
func (s *PaymentService) Start(ctx context.Context, userID, orderID int64) (*model.PaymentStart, error) {
	order, err := s.orders.GetByID(ctx, userID, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != model.OrderPending {
		return nil, &model.UserFacingError{
			Err:  model.ErrConflict,
			Text: "این سفارش قابل پرداخت نیست؛ وضعیت فعلی آن «" + orderStatusFa(order.Status) + "» است.",
		}
	}
	if order.Total <= 0 {
		return nil, &model.UserFacingError{
			Err:  model.ErrPaymentFailed,
			Text: "مبلغ این سفارش معتبر نیست.",
		}
	}

	amountRial := order.Total * rialPerToman

	// The attempt is recorded before the gateway is called, so a crash between
	// the two still leaves a trail to reconcile from.
	payment, err := s.payments.Create(ctx, order.ID, amountRial)
	if err != nil {
		return nil, err
	}

	authority, err := s.gateway.Request(ctx, zarinpal.RequestInput{
		AmountRial:  amountRial,
		CallbackURL: s.cfg.CallbackURL,
		Description: "پرداخت سفارش " + order.Code + " - شلوارسرا",
		Email:       s.customerEmail(ctx, userID),
		OrderCode:   order.Code,
	})
	if err != nil {
		text := "ارتباط با درگاه پرداخت برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید."
		var gwErr *zarinpal.Error
		if errors.As(err, &gwErr) {
			text = gwErr.Persian()
		}
		// Remember the reason on the attempt so support can see it later.
		_ = s.payments.Fail(ctx, payment.ID, text)
		return nil, &model.UserFacingError{Err: model.ErrPaymentFailed, Text: text}
	}

	if err := s.payments.SetAuthority(ctx, payment.ID, authority); err != nil {
		return nil, err
	}

	return &model.PaymentStart{
		PaymentID:  payment.ID,
		OrderID:    order.ID,
		OrderCode:  order.Code,
		Authority:  authority,
		GatewayURL: s.gateway.StartPayURL(authority),
		AmountRial: amountRial,
		Sandbox:    s.cfg.Sandbox,
	}, nil
}

// CallbackOutcome is the result of handling a gateway return.
type CallbackOutcome struct {
	OrderID   int64
	OrderCode string
	Paid      bool
	Message   string
}

// Callback finishes a payment after the customer returns from the gateway.
//
// It is deliberately idempotent: the callback can be replayed by a page reload,
// and a second verify answers 101 ("verified earlier"), which counts as success.
func (s *PaymentService) Callback(ctx context.Context, authority, status string) (*CallbackOutcome, error) {
	authority = strings.TrimSpace(authority)

	payment, err := s.payments.GetByAuthority(ctx, authority)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, &model.UserFacingError{
				Err:  model.ErrNotFound,
				Text: "تراکنشی با این شناسه پیدا نشد.",
			}
		}
		return nil, err
	}

	order, err := s.orders.GetByIDUnscoped(ctx, payment.OrderID)
	if err != nil {
		return nil, err
	}
	outcome := &CallbackOutcome{OrderID: order.ID, OrderCode: order.Code}

	// The customer cancelled or the gateway refused: nothing to verify.
	if !strings.EqualFold(strings.TrimSpace(status), "OK") {
		message := "پرداخت انجام نشد یا لغو شد."
		if payment.Status != model.PaymentVerified {
			_ = s.payments.Fail(ctx, payment.ID, message)
		}
		outcome.Message = message
		return outcome, nil
	}

	// Already settled: answer without touching the gateway again, so a reloaded
	// callback page still shows the same success.
	if payment.Status == model.PaymentVerified {
		outcome.Paid = true
		return outcome, nil
	}

	verified, err := s.gateway.Verify(ctx, authority, payment.Amount)
	if err != nil {
		text := "تأیید پرداخت با خطا مواجه شد."
		var gwErr *zarinpal.Error
		if errors.As(err, &gwErr) {
			text = gwErr.Persian()
		}
		_ = s.payments.Fail(ctx, payment.ID, text)
		outcome.Message = text
		return outcome, nil
	}

	if err := s.payments.Complete(ctx, payment.ID, order.ID, verified.RefID, verified.CardPan); err != nil {
		return nil, err
	}
	outcome.Paid = true
	outcome.Message = "پرداخت با موفقیت انجام شد."
	return outcome, nil
}

// Status returns the freshest view of an order's payment, for the result page
// to read after the browser has been redirected.
func (s *PaymentService) Status(ctx context.Context, userID, orderID int64) (*model.Order, error) {
	return s.orders.GetByID(ctx, userID, orderID)
}

// customerEmail is a best-effort hint for the gateway's receipt.
func (s *PaymentService) customerEmail(ctx context.Context, userID int64) string {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil || user == nil {
		return ""
	}
	return user.Email
}

// orderStatusFa renders a status for customers.
func orderStatusFa(status string) string {
	switch status {
	case model.OrderPending:
		return "در انتظار پرداخت"
	case model.OrderPaid:
		return "پرداخت‌شده"
	case model.OrderProcessing:
		return "در حال پردازش"
	case model.OrderShipped:
		return "ارسال‌شده"
	case model.OrderDelivered:
		return "تحویل‌شده"
	case model.OrderCanceled:
		return "لغوشده"
	default:
		return status
	}
}
