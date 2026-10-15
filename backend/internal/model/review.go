package model

import (
	"strings"
	"time"
)

// Review statuses, matching the review_status enum in the database.
const (
	ReviewPending  = "pending"
	ReviewApproved = "approved"
	ReviewRejected = "rejected"
)

// Review is one customer's opinion of one product. A review belongs to a single
// (product, user) pair: writing again edits the existing one.
type Review struct {
	ID        int64     `json:"id"`
	ProductID int64     `json:"productId"`
	UserID    int64     `json:"userId"`
	Rating    int32     `json:"rating"`
	Comment   string    `json:"comment"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ReviewInput is what a customer submits from the product page.
type ReviewInput struct {
	Rating  int32  `json:"rating"  validate:"required,gte=1,lte=5"`
	Comment string `json:"comment" validate:"omitempty,max=1500"`
}

// ReviewView is a review as the storefront shows it. The author is a shortened
// display name and there is no "verified buyer" flag: every published review
// comes from a delivered order, so they all are.
type ReviewView struct {
	ID        int64     `json:"id"`
	Rating    int32     `json:"rating"`
	Comment   string    `json:"comment"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"createdAt"`
}

// ReviewSummary is the rating breakdown the product page shows above the list.
// Stars[i] counts (i+1)-star reviews.
type ReviewSummary struct {
	Average float64  `json:"average"`
	Count   int64    `json:"count"`
	Stars   [5]int64 `json:"stars"`
}

// ProductReviews bundles the rating summary with one page of published reviews.
type ProductReviews struct {
	Summary ReviewSummary    `json:"summary"`
	Reviews Page[ReviewView] `json:"reviews"`
}

// MyReview answers "may this customer review the product, and what did they
// already write?" — the product page picks between the form, the moderation
// notice and the read-only text from it.
type MyReview struct {
	CanReview bool    `json:"canReview"`
	Review    *Review `json:"review,omitempty"`
}

// AdminReviewFilter carries the supported admin review-list parameters.
type AdminReviewFilter struct {
	Query  string // matches the product title, the customer name or the email
	Status string // pending | approved | rejected | "" for all
	Page   int
	Limit  int
}

// Offset converts page/limit into a SQL OFFSET.
func (f AdminReviewFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.Limit
}

// AdminReviewRow is one row of the moderation table: the review plus the
// product and the customer it belongs to.
type AdminReviewRow struct {
	Review       Review `json:"review"`
	ProductTitle string `json:"productTitle"`
	ProductSlug  string `json:"productSlug"`
	Author       string `json:"author"`
	Email        string `json:"email"`
}

// AdminReviewStatusInput is the moderation decision.
type AdminReviewStatusInput struct {
	Status string `json:"status" validate:"required,oneof=pending approved rejected"`
}

// MaskAuthor shortens a customer's display name for public display: the first
// name survives, the rest becomes an initial ("حسین جعفری" → "حسین ج.").
// A review is public; the account behind it is not.
func MaskAuthor(name string) string {
	fields := strings.Fields(name)
	switch len(fields) {
	case 0:
		return "کاربر شلوارسرا"
	case 1:
		return fields[0]
	default:
		return fields[0] + " " + string([]rune(fields[1])[0]) + "."
	}
}
