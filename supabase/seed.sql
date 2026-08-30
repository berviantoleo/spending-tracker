-- Seed: system categories
-- Run this once after applying all migrations via the Supabase Dashboard SQL Editor.
-- These rows have user_id = NULL (system-owned) and is_system = true.

INSERT INTO categories (id, user_id, name, icon, color, is_system) VALUES
  (gen_random_uuid(), NULL, 'Food',          '🍔', '#FF5722', true),
  (gen_random_uuid(), NULL, 'Transport',     '🚗', '#2196F3', true),
  (gen_random_uuid(), NULL, 'Shopping',      '🛍️', '#9C27B0', true),
  (gen_random_uuid(), NULL, 'Health',        '❤️', '#F44336', true),
  (gen_random_uuid(), NULL, 'Entertainment', '🎬', '#FF9800', true),
  (gen_random_uuid(), NULL, 'Utilities',     '💡', '#607D8B', true),
  (gen_random_uuid(), NULL, 'Travel',        '✈️', '#00BCD4', true),
  (gen_random_uuid(), NULL, 'Other',         '📦', '#9E9E9E', true);
