package service

import (
	"context"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// AddressService manages a user's shipping addresses. Every method is scoped by
// userID so one account can never touch another's data.
type AddressService struct {
	addresses *repository.AddressRepository
}

// NewAddressService wires the address service.
func NewAddressService(addresses *repository.AddressRepository) *AddressService {
	return &AddressService{addresses: addresses}
}

// List returns the user's addresses.
func (s *AddressService) List(ctx context.Context, userID int64) ([]model.Address, error) {
	return s.addresses.ListByUser(ctx, userID)
}

// Get returns one address owned by the user.
func (s *AddressService) Get(ctx context.Context, userID, id int64) (*model.Address, error) {
	return s.addresses.GetByID(ctx, userID, id)
}

// Create adds an address for the user.
func (s *AddressService) Create(ctx context.Context, userID int64, in *model.Address) (*model.Address, error) {
	in.ID = 0
	in.UserID = userID
	if err := s.addresses.Create(ctx, in); err != nil {
		return nil, err
	}
	return in, nil
}

// Update edits an address owned by the user.
func (s *AddressService) Update(ctx context.Context, userID int64, in *model.Address) (*model.Address, error) {
	in.UserID = userID
	return s.addresses.Update(ctx, in)
}

// Delete removes an address owned by the user.
func (s *AddressService) Delete(ctx context.Context, userID, id int64) error {
	return s.addresses.Delete(ctx, userID, id)
}
