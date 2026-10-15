package service

import (
	"context"
	"errors"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// maxLineQuantity caps a single line regardless of stock, so a typo or a
// scripted client cannot park a four-digit quantity in the cart.
const maxLineQuantity = 99

// CartService owns the rules of the shopping cart: which lines may be stored,
// how many of each, and what the resulting totals are.
type CartService struct {
	carts    *repository.CartRepository
	products *repository.ProductRepository
}

// NewCartService wires the cart service.
func NewCartService(carts *repository.CartRepository, products *repository.ProductRepository) *CartService {
	return &CartService{carts: carts, products: products}
}

// Get returns the user's cart, or an empty cart when they have never added
// anything. Callers therefore never have to special-case "no cart yet".
func (s *CartService) Get(ctx context.Context, userID int64) (*model.CartView, error) {
	cart, err := s.carts.GetByUser(ctx, userID)
	if errors.Is(err, model.ErrNotFound) {
		return model.NewCartView(nil), nil
	}
	if err != nil {
		return nil, err
	}
	return s.view(ctx, cart.ID)
}

// Add puts a product (with an optional variant) in the cart, merging into an
// existing line, and returns the whole cart.
func (s *CartService) Add(ctx context.Context, userID int64, in model.CartLineInput) (*model.CartView, error) {
	line, err := s.resolve(ctx, in)
	if err != nil {
		return nil, err
	}

	cart, err := s.carts.GetOrCreateByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if _, err := s.carts.AddItem(ctx, cart.ID, in.ProductID, in.VariantID, line.quantity, line.max); err != nil {
		return nil, err
	}
	return s.view(ctx, cart.ID)
}

// SetQuantity replaces the quantity of one line, clamped to the live stock.
func (s *CartService) SetQuantity(
	ctx context.Context, userID, itemID int64, quantity int32,
) (*model.CartView, error) {
	cart, err := s.carts.GetByUser(ctx, userID)
	if errors.Is(err, model.ErrNotFound) {
		return model.NewCartView(nil), nil
	}
	if err != nil {
		return nil, err
	}

	lines, err := s.carts.LoadLines(ctx, cart.ID)
	if err != nil {
		return nil, err
	}
	current, ok := findLine(lines, itemID)
	if !ok {
		return nil, model.ErrNotFound
	}
	if !current.IsAvailable {
		return nil, model.ErrOutOfStock
	}

	limit := current.MaxQuantity
	if limit > maxLineQuantity {
		limit = maxLineQuantity
	}

	if quantity < 1 {
		quantity = 1
	}
	if quantity > limit {
		quantity = limit
	}
	if err := s.carts.SetQuantity(ctx, cart.ID, itemID, quantity); err != nil {
		return nil, err
	}
	return s.view(ctx, cart.ID)
}

// Remove deletes one line from the cart.
func (s *CartService) Remove(ctx context.Context, userID, itemID int64) (*model.CartView, error) {
	cart, err := s.carts.GetByUser(ctx, userID)
	if errors.Is(err, model.ErrNotFound) {
		return model.NewCartView(nil), nil
	}
	if err != nil {
		return nil, err
	}
	if err := s.carts.DeleteItem(ctx, cart.ID, itemID); err != nil {
		return nil, err
	}
	return s.view(ctx, cart.ID)
}

// Clear empties the cart.
func (s *CartService) Clear(ctx context.Context, userID int64) (*model.CartView, error) {
	cart, err := s.carts.GetByUser(ctx, userID)
	if errors.Is(err, model.ErrNotFound) {
		return model.NewCartView(nil), nil
	}
	if err != nil {
		return nil, err
	}
	if err := s.carts.Clear(ctx, cart.ID); err != nil {
		return nil, err
	}
	return model.NewCartView(nil), nil
}

// Merge folds a guest cart, kept in the browser until the moment of sign-in,
// into the account's cart.
//
// Lines that are no longer purchasable are skipped instead of failing the whole
// sign-in; the caller gets the number of skipped lines so the UI can mention
// them. Quantities of lines present in both carts are summed, not replaced.
func (s *CartService) Merge(
	ctx context.Context, userID int64, inputs []model.CartLineInput,
) (*model.CartView, int32, error) {
	cart, err := s.carts.GetOrCreateByUser(ctx, userID)
	if err != nil {
		return nil, 0, err
	}

	var skipped int32
	for _, in := range inputs {
		line, err := s.resolve(ctx, in)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) || errors.Is(err, model.ErrOutOfStock) {
				skipped++
				continue
			}
			return nil, 0, err
		}
		if _, err := s.carts.AddItem(ctx, cart.ID, in.ProductID, in.VariantID, line.quantity, line.max); err != nil {
			return nil, 0, err
		}
	}

	view, err := s.view(ctx, cart.ID)
	if err != nil {
		return nil, 0, err
	}
	return view, skipped, nil
}

// resolvedLine is a validated line: the quantity that will be stored and the
// ceiling it was clamped against.
type resolvedLine struct {
	quantity int32
	max      int32
}

// resolve checks that the product is on sale, that the variant belongs to it,
// and clamps the requested quantity to the stock that is actually available.
func (s *CartService) resolve(ctx context.Context, in model.CartLineInput) (resolvedLine, error) {
	// includeInactive=false makes delisted products look like missing ones.
	product, err := s.products.GetByID(ctx, in.ProductID, false)
	if err != nil {
		return resolvedLine{}, err
	}

	max := product.Stock
	if in.VariantID != nil {
		variant, err := s.products.GetVariant(ctx, product.ID, *in.VariantID)
		if err != nil {
			return resolvedLine{}, err
		}
		max = variant.Stock
	}
	if max <= 0 {
		return resolvedLine{}, model.ErrOutOfStock
	}
	if max > maxLineQuantity {
		max = maxLineQuantity
	}

	quantity := in.Quantity
	if quantity < 1 {
		quantity = 1
	}
	if quantity > max {
		quantity = max
	}
	return resolvedLine{quantity: quantity, max: max}, nil
}

// view loads the cart's lines and totals them.
func (s *CartService) view(ctx context.Context, cartID int64) (*model.CartView, error) {
	lines, err := s.carts.LoadLines(ctx, cartID)
	if err != nil {
		return nil, err
	}
	return model.NewCartView(lines), nil
}

// findLine looks a line up by id.
func findLine(lines []model.CartLine, id int64) (model.CartLine, bool) {
	for _, line := range lines {
		if line.ID == id {
			return line, true
		}
	}
	return model.CartLine{}, false
}
