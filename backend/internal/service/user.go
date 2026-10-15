package service

import (
	"context"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// UserService exposes profile operations.
type UserService struct {
	users *repository.UserRepository
}

// NewUserService wires the user service.
func NewUserService(users *repository.UserRepository) *UserService {
	return &UserService{users: users}
}

// Get returns a user by id.
func (s *UserService) Get(ctx context.Context, id int64) (*model.User, error) {
	return s.users.GetByID(ctx, id)
}

// UpdateProfile changes the editable profile fields.
func (s *UserService) UpdateProfile(ctx context.Context, id int64, name, phone string) (*model.User, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, model.ErrValidation
	}
	return s.users.UpdateProfile(ctx, id, name, strings.TrimSpace(phone))
}
