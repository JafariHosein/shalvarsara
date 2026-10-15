package model

import "time"

// Address is a shipping address owned by a user.
type Address struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"userId"`
	ReceiverName string    `json:"receiverName"`
	Phone        string    `json:"phone"`
	Province     string    `json:"province"`
	City         string    `json:"city"`
	PostalCode   string    `json:"postalCode"`
	Line1        string    `json:"line1"`
	Line2        string    `json:"line2"`
	IsDefault    bool      `json:"isDefault"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
