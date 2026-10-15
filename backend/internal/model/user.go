package model

import "time"

// Role is a user's authorization level.
type Role string

const (
	RoleCustomer Role = "customer"
	RoleAdmin    Role = "admin"
)

// User is an account. PasswordHash is never serialized.
type User struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	IsActive     bool   `json:"isActive"`
	// PhoneVerifiedAt is set when the number was proven with an SMS code at
	// sign-up; a number typed in later through the profile is not verified.
	PhoneVerifiedAt *time.Time `json:"phoneVerifiedAt,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// IsAdmin reports whether the user may access admin endpoints.
func (u *User) IsAdmin() bool { return u.Role == RoleAdmin }
