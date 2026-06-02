-- 0007_order_templates.sql — PROJECT_SPEC §5.1, §11.1C
-- Saved "Standard Order" templates. Role-scoped per shop.

CREATE TABLE order_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  created_by  UUID NOT NULL REFERENCES profiles(id),
  name        TEXT NOT NULL,             -- e.g. "Standard Tuesday FOH Restock"
  role        TEXT NOT NULL,             -- which role this template belongs to
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_template_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES order_templates(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          NUMERIC(10,2) NOT NULL,
  custom_note       TEXT
);

CREATE TABLE order_template_item_modifiers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_item_id   UUID NOT NULL REFERENCES order_template_items(id) ON DELETE CASCADE,
  modifier_option_id UUID NOT NULL REFERENCES modifier_options(id)
);
