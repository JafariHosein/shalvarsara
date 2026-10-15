package model

import "time"

// WishlistRef is one saved product: its id and the moment it was saved. The
// product itself is loaded separately so it arrives in the same shape the
// catalogue uses.
type WishlistRef struct {
	ProductID int64
	AddedAt   time.Time
}

// WishlistEntry is a saved product as the account page shows it: the complete
// product, ready for the ordinary product card, plus when it was saved.
type WishlistEntry struct {
	Product Product   `json:"product"`
	AddedAt time.Time `json:"addedAt"`
}

// WishlistInput names the product a customer saves or drops.
type WishlistInput struct {
	ProductID int64 `json:"productId" validate:"required,gt=0"`
}
