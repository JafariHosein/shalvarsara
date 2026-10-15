package model

import "time"

// Product is a pair of trousers for sale. All money is integer Toman.
type Product struct {
	ID            int64            `json:"id"`
	Title         string           `json:"title"`
	Slug          string           `json:"slug"`
	ShortDesc     string           `json:"shortDesc"`
	Description   string           `json:"description"`
	CategoryID    int64            `json:"categoryId"`
	Category      *Category        `json:"category,omitempty"`
	Brand         string           `json:"brand"`
	Gender        string           `json:"gender"`
	PantType      string           `json:"pantType"`
	Fabric        string           `json:"fabric"`
	Price         int64            `json:"price"`
	DiscountPrice *int64           `json:"discountPrice,omitempty"`
	Stock         int32            `json:"stock"`
	SKU           string           `json:"sku"`
	RatingAvg     float64          `json:"ratingAvg"`
	RatingCount   int32            `json:"ratingCount"`
	SoldCount     int32            `json:"soldCount"`
	IsActive      bool             `json:"isActive"`
	IsFeatured    bool             `json:"isFeatured"`
	Images        []ProductImage   `json:"images"`
	Variants      []ProductVariant `json:"variants"`
	CreatedAt     time.Time        `json:"createdAt"`
	UpdatedAt     time.Time        `json:"updatedAt"`
}

// FinalPrice is the price a customer actually pays.
func (p *Product) FinalPrice() int64 {
	if p.DiscountPrice != nil && *p.DiscountPrice < p.Price {
		return *p.DiscountPrice
	}
	return p.Price
}

// HasDiscount reports whether the product is currently discounted.
func (p *Product) HasDiscount() bool {
	return p.DiscountPrice != nil && *p.DiscountPrice < p.Price
}

// DiscountPercent is the rounded percentage off, or 0 when not discounted.
func (p *Product) DiscountPercent() int32 {
	if !p.HasDiscount() || p.Price == 0 {
		return 0
	}
	return int32((p.Price - *p.DiscountPrice) * 100 / p.Price)
}

// ProductImage is one gallery image.
type ProductImage struct {
	ID        int64  `json:"id"`
	ProductID int64  `json:"productId"`
	URL       string `json:"url"`
	Alt       string `json:"alt"`
	IsPrimary bool   `json:"isPrimary"`
	SortOrder int32  `json:"sortOrder"`
}

// ProductVariant is a concrete purchasable size/colour combination.
type ProductVariant struct {
	ID         int64  `json:"id"`
	ProductID  int64  `json:"productId"`
	Size       string `json:"size"`
	Color      string `json:"color"`
	ColorHex   string `json:"colorHex"`
	Stock      int32  `json:"stock"`
	SKU        string `json:"sku"`
	ExtraPrice int64  `json:"extraPrice"`
}

// ProductFilter carries the supported product-list query parameters.
type ProductFilter struct {
	Query           string // free-text search on title
	CategoryID      *int64
	CategorySlug    string
	Size            string
	Color           string
	MinPrice        *int64
	MaxPrice        *int64
	InStock         *bool
	IsFeatured      *bool
	Gender          string
	PantType        string
	Sort            string // newest | cheapest | expensive | popular | discount | rating
	Page            int
	Limit           int
	IncludeInactive bool  // admin listings may include deactivated products
	IsActive        *bool // admin listings may filter on the active flag
}

// Offset converts page/limit into a SQL OFFSET.
func (f ProductFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.Limit
}
