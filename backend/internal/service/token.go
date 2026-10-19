package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/model"
)

// TokenType distinguishes access tokens from refresh tokens so a refresh token
// can never be used to call a protected endpoint.
type TokenType string

const (
	// TokenAccess authorizes API calls.
	TokenAccess TokenType = "access"
	// TokenRefresh is only accepted by the refresh endpoint.
	TokenRefresh TokenType = "refresh"
)

// SigningMethod is the single algorithm used across the app. Pinning it here
// prevents algorithm-confusion attacks.
var signingMethod = jwt.SigningMethodHS256

// Claims is the JWT payload.
type Claims struct {
	UserID int64     `json:"uid"`
	Role   string    `json:"role"`
	Type   TokenType `json:"typ"`
	// Version mirrors users.token_version at the time the token was minted.
	// A token whose version no longer matches the stored one has been revoked
	// (logout, password change, deactivation) and is rejected.
	Version int32 `json:"ver"`
	jwt.RegisteredClaims
}

// TokenPair is returned after a successful login or refresh.
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"` // access token lifetime in seconds
}

// TokenService issues and verifies JWTs.
type TokenService struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

// NewTokenService builds a token service from configuration.
func NewTokenService(cfg config.JWTConfig) *TokenService {
	return &TokenService{
		accessSecret:  []byte(cfg.AccessSecret),
		refreshSecret: []byte(cfg.RefreshSecret),
		accessTTL:     cfg.AccessTTL,
		refreshTTL:    cfg.RefreshTTL,
	}
}

// Generate mints a fresh access/refresh pair for a user.
func (s *TokenService) Generate(userID int64, role model.Role, tokenVersion int32) (TokenPair, error) {
	now := time.Now()

	access, err := s.sign(userID, role, tokenVersion, TokenAccess, now, s.accessTTL, s.accessSecret)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := s.sign(userID, role, tokenVersion, TokenRefresh, now, s.refreshTTL, s.refreshSecret)
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(s.accessTTL.Seconds()),
	}, nil
}

func (s *TokenService) sign(
	userID int64, role model.Role, tokenVersion int32, typ TokenType,
	now time.Time, ttl time.Duration, secret []byte,
) (string, error) {
	claims := Claims{
		UserID:  userID,
		Role:    string(role),
		Type:    typ,
		Version: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", userID),
			Issuer:    tokenIssuer,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(signingMethod, claims).SignedString(secret)
}

// tokenIssuer is checked on parse, so a token minted by another service that
// happens to share a secret is not accepted here.
const tokenIssuer = "shalvarsara"

// Parse verifies a token and asserts it is of the expected type.
func (s *TokenService) Parse(raw string, want TokenType) (*Claims, error) {
	secret := s.accessSecret
	if want == TokenRefresh {
		secret = s.refreshSecret
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		return secret, nil
	},
		jwt.WithValidMethods([]string{signingMethod.Alg()}),
		jwt.WithIssuer(tokenIssuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return nil, model.ErrUnauthorized
	}
	if claims.Type != want {
		return nil, model.ErrUnauthorized
	}
	return claims, nil
}
