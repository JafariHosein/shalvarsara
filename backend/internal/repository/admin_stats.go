package repository

import (
	"context"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// StatsRepository answers the aggregate questions the admin dashboard asks.
// It owns no table of its own: every query here is a read-only roll-up.
type StatsRepository struct {
	db *database.Pool
}

// NewStatsRepository wires the stats repository to the shared pool.
func NewStatsRepository(db *database.Pool) *StatsRepository {
	return &StatsRepository{db: db}
}

// Overview fills the dashboard counters and the trailing sales window.
func (r *StatsRepository) Overview(ctx context.Context) (*model.AdminStats, error) {
	var s model.AdminStats

	if err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(total) FILTER (WHERE status <> 'canceled'), 0),
			COUNT(*) FILTER (WHERE status <> 'canceled'),
			COUNT(*) FILTER (WHERE status = 'pending'),
			COUNT(*) FILTER (WHERE status IN ('paid', 'processing')),
			COUNT(*) FILTER (WHERE status = 'shipped'),
			COUNT(*) FILTER (WHERE status = 'delivered'),
			COUNT(*) FILTER (WHERE status = 'canceled')
		FROM orders`,
	).Scan(&s.Revenue, &s.OrderCount, &s.Pending, &s.ToFulfill, &s.Shipped, &s.Delivered, &s.Canceled); err != nil {
		return nil, err
	}
	if s.OrderCount > 0 {
		s.AvgOrder = s.Revenue / s.OrderCount
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM products WHERE deleted_at IS NULL),
			(SELECT count(*) FROM products WHERE deleted_at IS NULL AND is_active),
			(SELECT count(*) FROM product_variants v
			   JOIN products p ON p.id = v.product_id
			  WHERE p.deleted_at IS NULL),
			(SELECT count(*) FROM product_variants v
			   JOIN products p ON p.id = v.product_id
			  WHERE p.deleted_at IS NULL AND p.is_active AND v.stock <= 2),
			(SELECT count(*) FROM users)`,
	).Scan(&s.Products, &s.ActiveItems, &s.Variants, &s.LowStock, &s.Users); err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT to_char(d.day, 'YYYY-MM-DD'),
		       count(o.id),
		       COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'canceled'), 0)
		FROM generate_series((now()::date - interval '13 days')::date, now()::date, interval '1 day') AS d(day)
		LEFT JOIN orders o ON o.created_at::date = d.day
		GROUP BY d.day
		ORDER BY d.day`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	s.Sales = []model.SalesPoint{}
	for rows.Next() {
		var p model.SalesPoint
		if err := rows.Scan(&p.Date, &p.Orders, &p.Revenue); err != nil {
			return nil, err
		}
		s.Sales = append(s.Sales, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	s.TopSellers = []model.BestSeller{}
	s.RecentOrders = []model.AdminOrderSummary{}
	return &s, nil
}

// TopSellers returns the products that sold the most units, cancelled orders
// excluded.
func (r *StatsRepository) TopSellers(ctx context.Context, limit int) ([]model.BestSeller, error) {
	rows, err := r.db.Query(ctx, `
		SELECT oi.product_id, oi.title, COALESCE(p.slug, ''),
		       SUM(oi.quantity)::bigint,
		       SUM(oi.quantity * oi.unit_price)::bigint
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id AND o.status <> 'canceled'
		LEFT JOIN products p ON p.id = oi.product_id
		GROUP BY oi.product_id, oi.title, p.slug
		ORDER BY SUM(oi.quantity) DESC, SUM(oi.quantity * oi.unit_price) DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.BestSeller, 0, limit)
	for rows.Next() {
		var b model.BestSeller
		if err := rows.Scan(&b.ProductID, &b.Title, &b.Slug, &b.Quantity, &b.Revenue); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
