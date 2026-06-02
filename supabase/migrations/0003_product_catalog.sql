-- 0003_product_catalog.sql — PROJECT_SPEC §5.1, §9
-- 3-level catalog: Category -> Product -> Modifier Group -> Modifier Option.

CREATE TABLE product_categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,        -- 'Meat', 'Bread', 'Pastry', 'General Pantry'
  assigned_role    TEXT NOT NULL,               -- Which hub specialist owns this category
  display_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES product_categories(id),
  name             TEXT NOT NULL,               -- 'Lamb', 'Sourdough Loaf', 'Croissant'
  unit             TEXT NOT NULL,               -- 'kg', 'loaf', 'unit', 'litre'
  lead_time_hours  INT NOT NULL DEFAULT 24,     -- Minimum hours before requested delivery
  is_available     BOOLEAN NOT NULL DEFAULT TRUE,  -- The "86" toggle
  unavailable_note TEXT,                        -- Optional message to shops when 86'd
  display_order    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE modifier_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,               -- 'Cut', 'Prep State'
  is_required      BOOLEAN NOT NULL DEFAULT TRUE,
  display_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE modifier_options (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,              -- 'Minced', 'Sous-Vide', 'Leg'
  display_order     INT NOT NULL DEFAULT 0
);
