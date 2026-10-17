-- PrintFlow Realistic Seed Data
-- SaaS Platform Plans
INSERT INTO public.plans (id, name, tagline, price_monthly, price_yearly, print_limit, printer_limit, storage_limit_gb, features, is_active, is_popular)
VALUES
('b001a111-0000-0000-0000-000000000001', 'Free', 'For small single-counter shops', 0, 0, 300, 1, 2, '["1 Connected Printer", "Up to 300 pages/month", "Standard QR Generation", "Community Support"]'::jsonb, true, false),
('b001a111-0000-0000-0000-000000000002', 'Basic', 'Ideal for neighborhood Xerox shops', 499, 4990, 2000, 2, 10, '["2 Connected Printers", "Up to 2,000 pages/month", "Custom QR Branding", "Razorpay Direct Payouts", "Basic Analytics"]'::jsonb, true, false),
('b001a111-0000-0000-0000-000000000003', 'Pro', 'High-speed multi-counter print centers', 999, 9990, 10000, 5, 50, '["Up to 5 Printers", "Up to 10,000 pages/month", "Automated Queue Priority", "Custom Domain / Slug", "Priority Support", "Advanced Analytics"]'::jsonb, true, true),
('b001a111-0000-0000-0000-000000000004', 'Enterprise', 'Multi-branch commercial printing chains', 2499, 24990, 50000, 20, 200, '["Unlimited Printers", "Up to 50,000 pages/month", "Multi-Shop Manager", "Dedicated Account Manager", "SLA Guarantee", "Custom Webhooks"]'::jsonb, true, false)
ON CONFLICT (name) DO NOTHING;

-- Initial Platform Settings (Razorpay Configuration)
INSERT INTO public.platform_settings (id, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, razorpay_test_mode, currency, platform_fee_percent, support_email)
VALUES
(1, 'rzp_test_platform_991823ab', 'rzp_sec_platform_secret_key_8819', 'whsec_platform_event_key', true, 'INR', 2.50, 'support@printflow.in')
ON CONFLICT (id) DO NOTHING;

-- Sample Shop
INSERT INTO public.shops (
  id, name, slug, tagline, address, phone, email, status, is_open, business_hours, 
  min_order_amount, auto_accept, file_retention_days, 
  razorpay_key_id, razorpay_key_secret, razorpay_upi_id, razorpay_enabled, razorpay_test_mode, current_plan_id
)
VALUES (
  's001a111-0000-0000-0000-000000000001',
  'Shree Ganesh Xerox & Printing',
  'shree-ganesh-xerox',
  'Fast local document printing, Xerox, color copies & spiral binding',
  'Shop 4, University Circle, Station Road, Ahmedabad, Gujarat 380009',
  '+91 98765 43210',
  'ganesh.xerox@gmail.com',
  'ACTIVE',
  true,
  '8:30 AM - 9:30 PM (Mon-Sat)',
  2.00,
  true,
  7,
  'rzp_test_shop_ganesh8271',
  'rzp_sec_shop_secret_xyz123',
  'shreeganesh@oksbi',
  true,
  true,
  'b001a111-0000-0000-0000-000000000003'
)
ON CONFLICT (slug) DO NOTHING;
