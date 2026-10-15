package repository

import (
	"context"
	"strconv"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the admin side of user management.

// itoa is shorthand for the placeholder arithmetic below.
func itoa(n int) string { return strconv.Itoa(n) }

// ListForAdmin returns one page of users with the totals the admin table shows.
func (r *UserRepository) ListForAdmin(ctx context.Context, f model.AdminUserFilter) ([]model.AdminUserRow, int64, error) {
	conds := []string{"TRUE"}
	args := []any{}

	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+q+"%")
		ph := "$" + itoa(len(args))
		conds = append(conds, "(u.name ILIKE "+ph+" OR u.email ILIKE "+ph+" OR u.phone ILIKE "+ph+")")
	}
	if role := strings.TrimSpace(f.Role); role != "" && role != "all" {
		args = append(args, role)
		conds = append(conds, "u.role = $"+itoa(len(args))+"::user_role")
	}
	where := "WHERE " + strings.Join(conds, " AND ")

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM users u `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.AdminUserRow{}, 0, nil
	}

	listArgs := append(append([]any{}, args...), f.Limit, f.Offset())
	q := `
		SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.is_active,
		       u.created_at, u.updated_at,
		       COALESCE(agg.order_count, 0), COALESCE(agg.total_spent, 0), agg.last_order_at
		FROM users u
		LEFT JOIN (
			SELECT user_id, count(*) AS order_count,
			       COALESCE(SUM(total) FILTER (WHERE status <> 'canceled'), 0) AS total_spent,
			       max(created_at) AS last_order_at
			FROM orders GROUP BY user_id
		) agg ON agg.user_id = u.id
		` + where + `
		ORDER BY u.created_at DESC, u.id DESC
		LIMIT $` + itoa(len(args)+1) + ` OFFSET $` + itoa(len(args)+2)

	rows, err := r.db.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.AdminUserRow, 0, f.Limit)
	for rows.Next() {
		var (
			row  model.AdminUserRow
			role string
		)
		if err := rows.Scan(
			&row.User.ID, &row.User.Name, &row.User.Email, &row.User.Phone, &row.User.PasswordHash,
			&role, &row.User.IsActive, &row.User.CreatedAt, &row.User.UpdatedAt,
			&row.OrderCount, &row.TotalSpent, &row.LastOrder,
		); err != nil {
			return nil, 0, err
		}
		row.User.Role = model.Role(role)
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// UpdateAccess applies an admin's changes to a user's role and activity.
func (r *UserRepository) UpdateAccess(ctx context.Context, id int64, in model.AdminUserInput) (*model.User, error) {
	const q = `
		UPDATE users SET
			role = COALESCE($2::user_role, role),
			is_active = COALESCE($3, is_active),
			name = COALESCE($4, name),
			phone = COALESCE($5, phone)
		WHERE id = $1
		RETURNING ` + userColumns

	var role *string
	if in.Role != nil {
		s := string(*in.Role)
		role = &s
	}
	return scanUser(r.db.QueryRow(ctx, q, id, role, in.IsActive, in.Name, in.Phone))
}

// CountAdmins counts the active admins — used to refuse the change that would
// lock everybody out of the panel.
func (r *UserRepository) CountAdmins(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM users WHERE role = 'admin' AND is_active`).Scan(&n)
	return n, err
}
