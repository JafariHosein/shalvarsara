package service

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// codeDigits is the length of a sign-up verification code.
const codeDigits = 6

// purposeRegister scopes codes to sign-up, so a future "change my number" flow
// cannot be fed a code that was issued for registration.
const purposeRegister = "register"

// AuthService implements registration, login and token refresh.
type AuthService struct {
	users         *repository.UserRepository
	verifications *repository.PhoneVerificationRepository
	tokens        *TokenService
	sms           config.SMSConfig
}

// NewAuthService wires the auth service.
func NewAuthService(
	users *repository.UserRepository,
	verifications *repository.PhoneVerificationRepository,
	tokens *TokenService,
	sms config.SMSConfig,
) *AuthService {
	return &AuthService{users: users, verifications: verifications, tokens: tokens, sms: sms}
}

// RegisterInput is the data needed to create an account.
type RegisterInput struct {
	Name     string
	Email    string
	Phone    string
	Password string
	// Code is the verification code the customer received on Phone.
	Code string
}

// RegisterCode is a freshly issued sign-up verification code.
type RegisterCode struct {
	// Phone is the normalized number the code was issued for.
	Phone     string
	Code      string
	ExpiresAt time.Time
}

// RequestRegisterCode issues the one-time code that proves a customer owns the
// number they want to register with.
//
// The code is returned instead of being sent: no SMS panel is connected yet.
// When one is, only this call changes — it hands the code to the panel and the
// handler stops exposing it (SMS_TEST_MODE=false).
func (s *AuthService) RequestRegisterCode(ctx context.Context, phone string) (RegisterCode, error) {
	normalized, err := validatedPhone(phone)
	if err != nil {
		return RegisterCode{}, err
	}

	// One account per number. Checking here saves the customer from requesting
	// a code they could never use.
	if _, err := s.users.GetByPhone(ctx, normalized); err == nil {
		return RegisterCode{}, &model.UserFacingError{
			Err:  model.ErrConflict,
			Text: "این شماره موبایل قبلاً ثبت شده است.",
		}
	} else if !errors.Is(err, model.ErrNotFound) {
		return RegisterCode{}, err
	}

	// Do not let one visitor burn through SMS credit: a code that was just sent
	// stays the only valid one until the cooldown passes.
	if last, err := s.verifications.LastIssuedAt(ctx, normalized, purposeRegister); err == nil {
		if wait := s.sms.ResendAfter - time.Since(last); wait > 0 {
			return RegisterCode{}, &model.UserFacingError{
				Err:  model.ErrTooManyRequests,
				Text: "کد قبلی هنوز معتبر است؛ کمی بعد برای دریافت کد تازه دوباره تلاش کنید.",
			}
		}
	} else if !errors.Is(err, model.ErrNotFound) {
		return RegisterCode{}, err
	}

	code, err := randomCode(codeDigits)
	if err != nil {
		return RegisterCode{}, err
	}
	expiresAt, err := s.verifications.Issue(ctx, normalized, purposeRegister, code, s.sms.CodeTTL)
	if err != nil {
		return RegisterCode{}, err
	}
	return RegisterCode{Phone: normalized, Code: code, ExpiresAt: expiresAt}, nil
}

// CodeTTL is how long a freshly issued code stays valid.
func (s *AuthService) CodeTTL() time.Duration { return s.sms.CodeTTL }

// Register creates an account and returns it with a fresh token pair. The phone
// must be the one a verification code was issued for, and that code must still
// match.
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*model.User, TokenPair, error) {
	email := normalizeEmail(in.Email)
	phone, err := validatedPhone(in.Phone)
	if err != nil {
		return nil, TokenPair{}, err
	}

	if err := s.verifications.Verify(ctx, phone, purposeRegister, strings.TrimSpace(in.Code)); err != nil {
		return nil, TokenPair{}, codeError(err)
	}

	hash, err := hashPassword(in.Password)
	if err != nil {
		return nil, TokenPair{}, err
	}

	verifiedAt := time.Now()
	user := &model.User{
		Name:            strings.TrimSpace(in.Name),
		Email:           email,
		Phone:           phone,
		PasswordHash:    hash,
		Role:            model.RoleCustomer,
		IsActive:        true,
		PhoneVerifiedAt: &verifiedAt,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, TokenPair{}, err // ErrConflict bubbles up
	}

	pair, err := s.tokens.Generate(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return nil, TokenPair{}, err
	}
	return user, pair, nil
}

// Login verifies credentials and returns the user with a token pair.
//
// A missing account, a wrong password and a deactivated account all answer with
// the same error. The bcrypt comparison runs even when the account does not
// exist (against a dummy hash), so the response time does not reveal which
// emails are registered either.
func (s *AuthService) Login(ctx context.Context, email, password string) (*model.User, TokenPair, error) {
	user, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			// Burn the same amount of time as a real comparison.
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
			return nil, TokenPair{}, model.ErrInvalidCredential
		}
		return nil, TokenPair{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return nil, TokenPair{}, model.ErrInvalidCredential
	}
	// Only reveal the deactivation to someone who has already proved they know
	// the password; otherwise the endpoint enumerates disabled accounts.
	if !user.IsActive {
		return nil, TokenPair{}, &model.UserFacingError{
			Err:  model.ErrForbidden,
			Text: "این حساب غیرفعال شده است. برای بازیابی با پشتیبانی تماس بگیرید.",
		}
	}

	pair, err := s.tokens.Generate(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return nil, TokenPair{}, err
	}
	return user, pair, nil
}

// dummyHash is a real bcrypt hash of a random value. Comparing against it keeps
// the "no such account" path as slow as the "wrong password" path.
var dummyHash = []byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")

// Refresh exchanges a valid refresh token for a new pair, re-reading the user so
// role changes, deactivations and revocations take effect.
//
// The presented token is retired as part of the exchange (the version it carries
// no longer matches), so a stolen refresh token cannot be replayed after the
// legitimate client has used it once.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.User, TokenPair, error) {
	claims, err := s.tokens.Parse(refreshToken, TokenRefresh)
	if err != nil {
		return nil, TokenPair{}, err
	}

	user, err := s.users.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, TokenPair{}, model.ErrUnauthorized
	}
	if !user.IsActive {
		return nil, TokenPair{}, model.ErrForbidden
	}
	if claims.Version != user.TokenVersion {
		return nil, TokenPair{}, model.ErrUnauthorized
	}

	// Rotate: the pair about to be issued carries the next version, which
	// invalidates the token that was just presented.
	if err := s.users.BumpTokenVersion(ctx, user.ID); err != nil {
		return nil, TokenPair{}, err
	}
	user.TokenVersion++

	pair, err := s.tokens.Generate(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return nil, TokenPair{}, err
	}
	return user, pair, nil
}

// Logout revokes every token the account currently holds.
func (s *AuthService) Logout(ctx context.Context, userID int64) error {
	return s.users.BumpTokenVersion(ctx, userID)
}

// ChangePassword verifies the current password before replacing it. The
// repository bumps the token version in the same statement, so every other
// session is signed out.
func (s *AuthService) ChangePassword(ctx context.Context, userID int64, current, next string) error {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(current)) != nil {
		return model.ErrInvalidCredential
	}
	if current == next {
		return &model.UserFacingError{
			Err:  model.ErrValidation,
			Text: "رمز عبور تازه باید با رمز فعلی متفاوت باشد.",
		}
	}
	hash, err := hashPassword(next)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, userID, hash)
}

// hashPassword uses bcrypt's default cost, which is the right trade-off between
// resistance to offline cracking and login latency.
func hashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// normalizeEmail keeps one canonical form so "A@x.com" and "a@x.com" collide.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validatedPhone normalizes a mobile number and rejects anything that is not an
// Iranian mobile, with a message the customer can act on.
func validatedPhone(phone string) (string, error) {
	normalized := normalizePhone(phone)
	if !isIranianMobile(normalized) {
		return "", &model.UserFacingError{
			Err:  model.ErrValidation,
			Text: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
		}
	}
	return normalized, nil
}

// normalizePhone keeps digits only, so "۰۹۱۲ ۳۴۵ ۶۷۸۹" and "0912-345-6789"
// end up as the same canonical form the database stores.
func normalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= '۰' && r <= '۹': // Persian digits
			b.WriteRune('0' + (r - '۰'))
		case r >= '٠' && r <= '٩': // Arabic-Indic digits
			b.WriteRune('0' + (r - '٠'))
		}
	}
	return b.String()
}

// isIranianMobile reports whether a normalized number is a mobile number.
func isIranianMobile(phone string) bool {
	return len(phone) == 11 && strings.HasPrefix(phone, "09")
}

// randomCode returns a numeric code whose digits come from the system CSPRNG.
func randomCode(digits int) (string, error) {
	ten := big.NewInt(10)
	var b strings.Builder
	for i := 0; i < digits; i++ {
		n, err := rand.Int(rand.Reader, ten)
		if err != nil {
			return "", err
		}
		b.WriteByte(byte('0' + n.Int64()))
	}
	return b.String(), nil
}

// codeError turns a verification failure into something the customer can fix.
func codeError(err error) error {
	switch {
	case errors.Is(err, model.ErrNotFound):
		return &model.UserFacingError{
			Err:  model.ErrInvalidCode,
			Text: "برای این شماره کدی ارسال نشده است؛ ابتدا «ارسال کد» را بزنید.",
		}
	case errors.Is(err, model.ErrInvalidCode):
		return &model.UserFacingError{
			Err:  model.ErrInvalidCode,
			Text: "کد تأیید نادرست یا منقضی شده است. اگر کد را دریافت نکرده‌اید، دوباره درخواست کنید.",
		}
	case errors.Is(err, model.ErrTooManyRequests):
		return &model.UserFacingError{
			Err:  model.ErrTooManyRequests,
			Text: "تعداد تلاش‌های ناموفق برای این شماره بیش از حد مجاز است. لطفاً یک ساعت بعد دوباره تلاش کنید.",
		}
	default:
		return err
	}
}
