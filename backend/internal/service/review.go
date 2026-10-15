package service

import (
	"context"
	"errors"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// ReviewService owns the rules of customer reviews: who may write one — only a
// customer the product has already reached — and what the storefront gets to
// see while a review is waiting for moderation.
type ReviewService struct {
	reviews  *repository.ReviewRepository
	products *repository.ProductRepository
}

// NewReviewService wires the review service.
func NewReviewService(
	reviews *repository.ReviewRepository, products *repository.ProductRepository,
) *ReviewService {
	return &ReviewService{reviews: reviews, products: products}
}

// List returns the published reviews of one product plus its rating breakdown.
// Delisted products read as missing, exactly like the product page itself.
func (s *ReviewService) List(
	ctx context.Context, slug string, page, limit int,
) (*model.ProductReviews, error) {
	product, err := s.products.GetBySlug(ctx, slug, false)
	if err != nil {
		return nil, err
	}
	page, limit = normalizePaging(page, limit)

	total, err := s.reviews.CountApproved(ctx, product.ID)
	if err != nil {
		return nil, err
	}
	summary, err := s.reviews.Summary(ctx, product.ID)
	if err != nil {
		return nil, err
	}

	items := []model.ReviewView{}
	if total > 0 {
		offset := (page - 1) * limit
		if items, err = s.reviews.ListApproved(ctx, product.ID, limit, offset); err != nil {
			return nil, err
		}
	}
	return &model.ProductReviews{
		Summary: summary,
		Reviews: model.NewPage(items, page, limit, total),
	}, nil
}

// Mine reports whether the signed-in customer may review the product and, when
// they already wrote one, what it says — pending, approved or rejected.
func (s *ReviewService) Mine(ctx context.Context, slug string, userID int64) (*model.MyReview, error) {
	product, err := s.products.GetBySlug(ctx, slug, false)
	if err != nil {
		return nil, err
	}

	earned, err := s.reviews.HasDeliveredPurchase(ctx, userID, product.ID)
	if err != nil {
		return nil, err
	}

	review, err := s.reviews.GetByUser(ctx, product.ID, userID)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return nil, err
	}
	return &model.MyReview{CanReview: earned, Review: review}, nil
}

// Create stores the customer's review, or their edit of an earlier one, and
// returns it as it now stands: waiting for moderation either way.
func (s *ReviewService) Create(
	ctx context.Context, slug string, userID int64, in model.ReviewInput,
) (*model.Review, error) {
	product, err := s.products.GetBySlug(ctx, slug, false)
	if err != nil {
		return nil, err
	}

	// A review has to be earned: the product must sit in one of this customer's
	// delivered orders. Anyone else gets a message instead of a form.
	earned, err := s.reviews.HasDeliveredPurchase(ctx, userID, product.ID)
	if err != nil {
		return nil, err
	}
	if !earned {
		return nil, model.ErrReviewNotAllowed
	}

	review, err := s.reviews.Upsert(ctx, product.ID, userID, in.Rating, strings.TrimSpace(in.Comment))
	if err != nil {
		return nil, err
	}
	// Editing an approved review pulls it back into the queue, so the product's
	// public rating has to follow.
	if err := s.reviews.RecalcProductRating(ctx, product.ID); err != nil {
		return nil, err
	}
	return review, nil
}
