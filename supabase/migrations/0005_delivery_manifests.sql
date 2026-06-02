-- 0005_delivery_manifests.sql — PROJECT_SPEC §5.1, §8
-- Courier's daily delivery manifest and its per-shop stops.

CREATE TABLE delivery_manifests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id      UUID NOT NULL REFERENCES profiles(id),
  delivery_date   DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_transit', 'completed')),
  route_data      JSONB,    -- Google Maps optimized route response, cached
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE manifest_stops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id     UUID NOT NULL REFERENCES delivery_manifests(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  stop_sequence   INT NOT NULL,
  signed_off_by   UUID REFERENCES profiles(id),   -- Shop manager who received
  signed_off_at   TIMESTAMPTZ,
  signature_data  TEXT    -- Base64 signature string (if using digital signature)
);
