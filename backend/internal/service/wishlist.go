package service

import (
	"context"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// wishlistPageSize is the cap on a single wishlist response. The list is meant
// to stay short; the envelope keeps the shape the other list endpoints use.
const wishlistPageSize = 100

// WishlistService owns the saved-for-later list. It stores nothing itself:
// wishlist rows live in the repository, the products come from the catalogue.
type WishlistService struct {
	wishlists *repository.WishlistRepository
	products  *repository.ProductRepository
}

// NewWishlistService wires the wishlist service.
func NewWishlistService(
	wishlists *repository.WishlistRepository, products *repository.ProductRepository,
) *WishlistService {
	return &WishlistService{wishlists: wishlists, products: products}
}

// List returns the saved products, newest first, in the same shape the
// catalogue uses so the account page can render ordinary product cards.
func (s *WishlistService) List(
	ctx context.Context, userID int64,
) (model.Page[model.WishlistEntry], error) {
	refs, err := s.wishlists.Refs(ctx, userID)
	if err != nil {
		return model.Page[model.WishlistEntry]{}, err
	}
	if len(refs) == 0 {
		return model.NewPage([]model.WishlistEntry{}, 1, wishlistPageSize, 0), nil
	}

	ids := make([]int64, 0, len(refs))
	for _, ref := range refs {
		ids = append(ids, ref.ProductID)
	}
	products, err := s.products.ListByIDs(ctx, ids)
	if err != nil {
		return model.Page[model.WishlistEntry]{}, err
	}
	byID := make(map[int64]model.Product, len(products))
	for _, product := range products {
		byID[product.ID] = product
	}

	// Keep the newest-first order, and let products that are no longer on sale
	// drop out silently rather than appearing as something one could buy.
	entries := make([]model.WishlistEntry, 0, len(refs))
	for _, ref := range refs {
		if product, ok := byID[ref.ProductID]; ok {
			entries = append(entries, model.WishlistEntry{Product: product, AddedAt: ref.AddedAt})
		}
	}
	return model.NewPage(entries, 1, wishlistPageSize, int64(len(entries))), nil
}

// Add saves a product for later and returns the whole list. A delisted product
// reads as missing, so nothing can be saved that cannot be bought.
func (s *WishlistService) Add(
	ctx context.Context, userID, productID int64,
) (model.Page[model.WishlistEntry], error) {
	if _, err := s.products.GetByID(ctx, productID, false); err != nil {
		return model.Page[model.WishlistEntry]{}, err
	}
	if err := s.wishlists.Add(ctx, userID, productID); err != nil {
		return model.Page[model.WishlistEntry]{}, err
	}
	return s.List(ctx, userID)
}

// Remove drops a saved product and returns the whole list.
func (s *WishlistService) Remove(
	ctx context.Context, userID, productID int64,
) (model.Page[model.WishlistEntry], error) {
	if err := s.wishlists.Remove(ctx, userID, productID); err != nil {
		return model.Page[model.WishlistEntry]{}, err
	}
	return s.List(ctx, userID)
}
