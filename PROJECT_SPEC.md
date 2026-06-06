# PROJECT_SPEC.md — HubSync Internal Café Operations Platform
**Version:** 2.1  
**Status:** Living Document — Update in the same PR as any system change.  
**Rule:** If you are about to write code that touches the database, auth, order flow, or notifications, re-read Sections 5, 6, 7, and 8 first. Documentation drift is a bug.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Hard Constraints](#2-hard-constraints)
3. [Architecture](#3-architecture)
4. [Stack — Exact Versions & Rationale](#4-stack--exact-versions--rationale)
5. [Database Schema](#5-database-schema)
6. [User Roles & RBAC](#6-user-roles--rbac)
7. [Order Lifecycle & State Machine](#7-order-lifecycle--state-machine)
8. [Two-Way Handshake — Full Technical Flow](#8-two-way-handshake--full-technical-flow)
9. [Product Catalog Architecture](#9-product-catalog-architecture)
10. [Timing Protocols & Cut-off Logic](#10-timing-protocols--cut-off-logic)
11. [Operational Dashboards — Screen-by-Screen Spec](#11-operational-dashboards--screen-by-screen-spec)
12. [Automated Accounting & Receipts](#12-automated-accounting--receipts)
13. [Notification Architecture](#13-notification-architecture)
14. [Offline Mode Strategy](#14-offline-mode-strategy)
15. [Security Model](#15-security-model)
16. [Open Architectural Decisions (With Recommendations)](#16-open-architectural-decisions-with-recommendations)
17. [Development Workflow](#17-development-workflow)
18. [Phase 2 — AI Predictive Layer](#18-phase-2--ai-predictive-layer)
19. [Glossary](#19-glossary)

---

## 1. Product Overview

HubSync is a closed-ecosystem, internal B2B ERP mobile application for a 7-location café brand. It replaces ad-hoc text/phone communication between satellite café branches ("Shops") and the central production facility ("Hub"). 

**Core problem it solves:**  
Shops currently call or text the Hub to order fresh ingredients. This causes duplicate orders, missed orders, no accountability trail, no financial record, and zero visibility into Hub production capacity. HubSync imposes structure: orders must pass through a dual-approval gate, every action is timestamped server-side, and all financial movements are auto-documented.

### 1.1 Branding & Naming Rules
All code, UI labels, and documentation must use these terms consistently:

| Context | Term |
|---|---|
| Customer-facing brand name | TBD (do not hardcode) |
| Internal codename (repos, infra) | HubSync |
| The 7 satellite café locations | **Shops** (never "branches" or "stores") |
| The central production facility | **Hub** (never "kitchen HQ" or "warehouse") |
| The logistics role | **Courier** (never "driver" or "delivery") |
| A production task in-flight | **Order** (never "ticket" or "request" after confirmation) |
| A shop's unconfirmed submission | **Request** (never "order" — until Approval 2 completes) |

### 1.2 What This Is NOT
Anchor every decision to the internal B2B context. HubSync is not:
- A customer-facing app or POS system
- A generic delivery app (UberEats / Deliveroo clone)
- A public marketplace
- A restaurant management system (no table management, no customer profiles)

---

## 2. Hard Constraints

These are non-negotiable. If a proposed feature conflicts with one of these, the feature is wrong — not the constraint.

| # | Constraint | Why |
|---|---|---|
| C1 | Internal staff only. No public sign-up. | Security. This app touches financial records and production data. |
| C2 | Hardcoded to 7 Shops + 1 Hub for v1. | Keeps v1 scope controlled. DB is designed to scale, but UI assumes fixed nodes. |
| C3 | Products are never flat items. They require Modifier chains. | "Beef" is not an order. "Beef → Minced → Cooked" is. |
| C4 | Lead times are system-enforced, not advisory. | The app physically blocks invalid delivery date selections. |
| C5 | All timestamps validated server-side. | Device clocks can be manipulated to beat the 4:00 PM cut-off. |
| C6 | Orders are immutable after Final Confirm. | If more is needed, a new Request is opened. No patching confirmed orders. |
| C7 | Hub production queues are strictly role-filtered. | The Bread Baker must never see a Meat order. |
| C8 | RLS enforced at the database level, not just the app. | App-level filtering is not sufficient; Supabase RLS is the authoritative gate. |
| C9 | Shop A cannot read Shop B's data. | Multi-tenant isolation is non-negotiable. |

---

## 3. Architecture

### 3.1 High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Shop App        │  │  Hub App         │  │  Admin Web       │   │
│  │  (Flutter)       │  │  (Flutter)       │  │  (Next.js 14)    │   │
│  │  iOS + Android   │  │  iOS + Android   │  │  Browser only    │   │
│  │  FOH + Kitchen   │  │  Specialists +   │  │  Brand Owner     │   │
│  │  Managers        │  │  Courier         │  │  only            │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │             │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          BACKEND LAYER (Supabase)                    │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  PostgREST   │  │  Realtime    │  │  Auth (JWT + RLS)        │   │
│  │  (REST API)  │  │  (WebSocket) │  │  19 profiles, 6 roles    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  PostgreSQL  │  │  Edge Funcs  │  │  Storage (PDF receipts)  │   │
│  │  (Primary DB)│  │  (Node.js)   │  │                          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                              │
│                                                                      │
│  Firebase Cloud Messaging    Google Maps API    (Phase 2: Weather    │
│  (Push Notifications)        (Courier Routing)   + Events APIs)      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Environment Strategy

Three environments must exist before any team member writes a line of code. Never test against production data.

| Env | Supabase Project | Purpose | Who has access |
|---|---|---|---|
| `dev` | `hubsync-dev` | Local development and feature work | All developers |
| `staging` | `hubsync-staging` | QA, UAT with the business owner | Dev team + client |
| `prod` | `hubsync-prod` | Live system | Automated deploy only (CI/CD) |

Environment is determined at build time via `.env` files. Never commit `.env` files. See Section 17 for the `.env.example` template.

### 3.3 Monorepo Structure

```
hubsync/
├── apps/
│   ├── shop_app/           # Flutter app (FOH + Kitchen roles)
│   ├── hub_app/            # Flutter app (Specialists + Courier roles)
│   └── admin_web/          # Next.js 14 (Admin role)
├── packages/
│   ├── shared_models/      # Dart/TS data models shared across apps
│   └── shared_constants/   # Role enums, status enums, route names
├── supabase/
│   ├── migrations/         # Numbered SQL migration files
│   ├── functions/          # Edge Functions (PDF gen, cron jobs)
│   └── seed/               # Dev + staging seed data
├── docs/
│   └── PROJECT_SPEC.md     # This file
└── .github/
    └── workflows/          # CI/CD pipelines
```

---

## 4. Stack — Exact Versions & Rationale

| Layer | Tool | Version | Rationale |
|---|---|---|---|
| Mobile Framework | Flutter | Latest stable | Single codebase for iOS + Android. Dart is statically typed — fewer runtime surprises. |
| Web Framework (Admin) | Next.js | 14 (App Router) | SSR for admin dashboard performance. React ecosystem for component reuse. |
| Database + Auth | Supabase | Latest | PostgreSQL + RLS + Realtime in one managed service. Avoids building auth from scratch. |
| Backend Logic | Supabase Edge Functions | Node.js (Deno runtime) | Serverless. Used for PDF generation, cut-off cron jobs, monthly aggregation. |
| Offline Cache | Drift (SQLite wrapper) | Latest | Type-safe SQLite for Flutter. Handles local schema migration cleanly. |
| Push Notifications | Firebase Cloud Messaging | Latest | Reliable cross-platform push. Required for the Two-Way Handshake alerts. |
| Maps + Routing | Google Maps API | Directions API v2 | Optimized multi-stop routing for Courier manifests. |
| PDF Generation | Puppeteer (Edge Function) | Latest | Renders HTML receipt template to PDF server-side. |
| State Management (Flutter) | Riverpod | 2.x | Compile-safe, testable. Avoids Provider anti-patterns. |
| HTTP Client (Flutter) | Supabase Flutter SDK | Latest | Handles auth headers, realtime, and RLS automatically. |

---

## 5. Database Schema

All migrations live in `supabase/migrations/`. Files are numbered: `0001_initial_schema.sql`, `0002_add_86_protocol.sql`, etc. Never edit a deployed migration — write a new one.

### 5.1 Core Tables

```sql
-- ─────────────────────────────────────────────
-- SHOPS
-- ─────────────────────────────────────────────
CREATE TABLE shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                        -- e.g. "Shop C - Camden"
  address     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'Europe/London',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- v1: seed with 7 rows. UI hardcodes these. DB is scalable.

-- ─────────────────────────────────────────────
-- PROFILES (linked to Supabase Auth users)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN (
                'foh_manager',
                'kitchen_manager',
                'meat_specialist',
                'bread_baker',
                'pastry_chef',
                'courier',
                'admin'
              )),
  shop_id     UUID REFERENCES shops(id),  -- NULL for hub roles
  fcm_token   TEXT,                       -- Firebase push token, updated on login
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Constraint: shop_id must be populated for foh_manager + kitchen_manager.
-- shop_id must be NULL for hub roles (meat_specialist, bread_baker, etc.)
ALTER TABLE profiles ADD CONSTRAINT check_shop_role
  CHECK (
    (role IN ('foh_manager', 'kitchen_manager') AND shop_id IS NOT NULL) OR
    (role NOT IN ('foh_manager', 'kitchen_manager') AND shop_id IS NULL)
  );

-- ─────────────────────────────────────────────
-- PRODUCT CATALOG
-- ─────────────────────────────────────────────
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
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,               -- 'Minced', 'Sous-Vide', 'Leg'
  display_order    INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- ORDER TEMPLATES (Standard Order feature)
-- ─────────────────────────────────────────────
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
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_item_id      UUID NOT NULL REFERENCES order_template_items(id) ON DELETE CASCADE,
  modifier_option_id    UUID NOT NULL REFERENCES modifier_options(id)
);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  submitted_by        UUID NOT NULL REFERENCES profiles(id),
  
  -- Status (see Section 7 for valid transitions)
  status              TEXT NOT NULL DEFAULT 'pending_request'
                        CHECK (status IN (
                          'pending_request',
                          'specialist_approved',
                          'shop_confirmed',
                          'in_progress',
                          'packaged',
                          'ready_for_courier',
                          'in_transit',
                          'delivered',
                          'rejected',
                          'cancelled'
                        )),
  
  -- Timing
  requested_delivery_date  DATE NOT NULL,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  specialist_approved_at   TIMESTAMPTZ,
  shop_confirmed_at        TIMESTAMPTZ,
  packaged_at              TIMESTAMPTZ,
  ready_at                 TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  
  -- Personnel
  assigned_specialist      UUID REFERENCES profiles(id),
  assigned_courier         UUID REFERENCES profiles(id),
  
  -- Accounting
  receipt_id               UUID,    -- FK added after receipts table is created
  
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  quantity          NUMERIC(10,2) NOT NULL,
  unit              TEXT NOT NULL,         -- Denormalized from product at time of order
  custom_note       TEXT,
  unit_cost         NUMERIC(10,2),         -- Set at time of specialist approval
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_item_modifiers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id         UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_option_id    UUID NOT NULL REFERENCES modifier_options(id),
  modifier_group_name   TEXT NOT NULL,    -- Denormalized for receipt readability
  modifier_option_name  TEXT NOT NULL     -- Denormalized for receipt readability
);

-- ─────────────────────────────────────────────
-- DELIVERY MANIFESTS
-- ─────────────────────────────────────────────
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
  shop_id         UUID NOT NULL REFERENCES shops(id),
  stop_sequence   INT NOT NULL,
  signed_off_by   UUID REFERENCES profiles(id),   -- Shop manager who received
  signed_off_at   TIMESTAMPTZ,
  signature_data  TEXT,    -- Base64 signature string (if using digital signature)
  CONSTRAINT manifest_stops_unique_shop UNIQUE (manifest_id, shop_id)
);

-- ─────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────
CREATE TABLE receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_month    INT,      -- Populated by monthly aggregation cron (1-12)
  period_year     INT,      -- Populated by monthly aggregation cron
  pdf_storage_path TEXT NOT NULL,    -- Path in Supabase Storage
  total_cost      NUMERIC(10,2),
  is_monthly_summary BOOLEAN NOT NULL DEFAULT FALSE
);

-- Back-fill FK on orders
ALTER TABLE orders ADD CONSTRAINT fk_orders_receipt
  FOREIGN KEY (receipt_id) REFERENCES receipts(id);

-- ─────────────────────────────────────────────
-- CUT-OFF CONFIGURATION (managed by Admin)
-- ─────────────────────────────────────────────
CREATE TABLE cutoff_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_time     TIME NOT NULL DEFAULT '16:00:00',   -- 4:00 PM server time
  timezone        TEXT NOT NULL DEFAULT 'Europe/London',
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by      UUID REFERENCES profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Only one row should be active. App reads the latest record.

-- ─────────────────────────────────────────────
-- INDEXES (performance-critical paths)
-- ─────────────────────────────────────────────
CREATE INDEX idx_orders_shop_id         ON orders(shop_id);
CREATE INDEX idx_orders_status          ON orders(status);
CREATE INDEX idx_orders_delivery_date   ON orders(requested_delivery_date);
CREATE INDEX idx_orders_assigned_spec   ON orders(assigned_specialist);
CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_products_category_id   ON products(category_id);
CREATE INDEX idx_products_available     ON products(is_available);
```

### 5.2 Triggers

```sql
-- Auto-update updated_at on orders
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER products_touch_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

---

## 6. User Roles & RBAC

### 6.1 Role Definitions

There are **19 total logins** across the business at v1 launch.

| Role | Count | app | Can Submit Requests | Can Approve (Stage 1) | Can Confirm (Stage 2) | Can Update Production State | Can Sign Off Delivery | Full Admin |
|---|---|---|---|---|---|---|---|---|
| `foh_manager` | 7 | Shop App | ✅ (FOH items only) | ❌ | ✅ | ❌ | ✅ | ❌ |
| `kitchen_manager` | 7 | Shop App | ✅ (Kitchen items only) | ❌ | ✅ | ❌ | ✅ | ❌ |
| `meat_specialist` | 1 | Hub App | ❌ | ✅ (Meat category only) | ❌ | ✅ | ❌ | ❌ |
| `bread_baker` | 1 | Hub App | ❌ | ✅ (Bread category only) | ❌ | ✅ | ❌ | ❌ |
| `pastry_chef` | 1 | Hub App | ❌ | ✅ (Pastry category only) | ❌ | ✅ | ❌ | ❌ |
| `courier` | 1 | Hub App | ❌ | ❌ | ❌ | ❌ | ❌ (initiates sign-off screen) | ❌ |
| `admin` | 1 | Admin Web | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 6.2 Row-Level Security (RLS) Policies

All policies live in `supabase/migrations/0002_rls_policies.sql`. These are the authoritative access rules — app-level filtering is a secondary UX layer only.

```sql
-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_manifests ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION current_role_name()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function: get current user's shop_id
CREATE OR REPLACE FUNCTION current_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ── ORDERS: Shops only see their own orders ─────────────────────────
CREATE POLICY "shops_read_own_orders" ON orders
  FOR SELECT USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
  );

-- ── ORDERS: Specialists see only their category's pending orders ──────
-- (Each specialist's readable set is filtered by product category join,
--  handled in the application query layer on top of this base policy)
CREATE POLICY "specialists_read_relevant_orders" ON orders
  FOR SELECT USING (
    current_role_name() IN ('meat_specialist', 'bread_baker', 'pastry_chef')
    AND status NOT IN ('pending_request', 'cancelled', 'rejected')
    -- Category filtering done via order_items JOIN in application queries
  );

-- ── ORDERS: Courier sees only packaged/ready/in-transit orders ───────
CREATE POLICY "courier_read_assigned_orders" ON orders
  FOR SELECT USING (
    current_role_name() = 'courier'
    AND status IN ('ready_for_courier', 'in_transit', 'delivered')
  );

-- ── ORDERS: Admin sees everything ────────────────────────────────────
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT USING (current_role_name() = 'admin');

-- ── PRODUCTS: Everyone can read available products ───────────────────
CREATE POLICY "all_read_available_products" ON products
  FOR SELECT USING (is_available = TRUE);

-- ── PRODUCTS: Only Admin can write products ──────────────────────────
CREATE POLICY "admin_write_products" ON products
  FOR ALL USING (current_role_name() = 'admin');

-- ── PRODUCTS: Specialists can toggle their own category's 86 ─────────
CREATE POLICY "specialist_toggle_86" ON products
  FOR UPDATE USING (
    (current_role_name() = 'meat_specialist'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'meat_specialist'))
    OR
    (current_role_name() = 'bread_baker'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'bread_baker'))
    OR
    (current_role_name() = 'pastry_chef'
      AND category_id IN (SELECT id FROM product_categories WHERE assigned_role = 'pastry_chef'))
  );

-- ── PROFILES: Users see only their own profile ───────────────────────
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (current_role_name() = 'admin');

-- ── RECEIPTS: Shops see their own, Admin sees all ────────────────────
CREATE POLICY "shops_read_own_receipts" ON receipts
  FOR SELECT USING (
    current_role_name() IN ('foh_manager', 'kitchen_manager')
    AND shop_id = current_shop_id()
  );

CREATE POLICY "admin_read_all_receipts" ON receipts
  FOR SELECT USING (current_role_name() = 'admin');
```

---

## 7. Order Lifecycle & State Machine

### 7.1 Status Definitions

| Status | Meaning | Who can see it |
|---|---|---|
| `pending_request` | Shop has submitted; awaiting Specialist approval | Originating Shop + Admin |
| `specialist_approved` | Specialist confirmed capability; awaiting Shop's Final Confirm | Originating Shop + Specialist + Admin |
| `shop_confirmed` | Both approvals complete; order is live | Shop + Specialist + Courier + Admin |
| `in_progress` | Specialist has started production | Shop + Specialist + Admin |
| `packaged` | Items physically packed and labelled | Shop + Specialist + Courier + Admin |
| `ready_for_courier` | Order in Courier's queue | Courier + Admin |
| `in_transit` | Courier has picked up and is on route | Shop + Courier + Admin |
| `delivered` | Shop signed off. Receipt generated. | All roles |
| `rejected` | Specialist rejected the request (unable to fulfil) | Originating Shop + Admin |
| `cancelled` | Shop cancelled before Final Confirm | Admin only |

### 7.2 State Transition Diagram

```
                      ┌─────────────────────────────────────────────────────┐
                      │               VALID TRANSITIONS                      │
                      └─────────────────────────────────────────────────────┘

[Shop submits cart]
        │
        ▼
  pending_request ──── [Specialist rejects] ──────────────────► rejected
        │
        │ [Specialist taps "Approve & Quote"]
        ▼
  specialist_approved ── [Shop cancels] ───────────────────────► cancelled
        │
        │ [Shop taps "Final Confirm"]
        ▼
  shop_confirmed ─────────────────────────────────────────────────────┐
        │                                                              │
        │ [Specialist updates state]                          (simultaneously
        ▼                                                     pushed to Courier)
  in_progress
        │
        │ [Specialist taps "Packaged"]
        ▼
    packaged
        │
        │ [Specialist taps "Ready for Courier"]
        ▼
  ready_for_courier
        │
        │ [Courier picks up + confirms pickup in app]
        ▼
    in_transit
        │
        │ [Shop Manager taps "Received" + signs off]
        ▼
    delivered ──────────────────────────────────────► [PDF receipt auto-generated]
```

### 7.3 Invalid Transitions — DO NOT IMPLEMENT

Any transition not listed in 7.2 is explicitly forbidden. The backend must reject these at the Edge Function level, not just the UI.

- `pending_request` → `in_progress` (bypasses the handshake — never allowed)
- `shop_confirmed` → `pending_request` (no rollbacks after both approvals)
- `delivered` → any state (terminal state — immutable)
- `rejected` → any state (terminal state — open a new Request)
- `cancelled` → any state (terminal state — open a new Request)

### 7.4 State Transition Enforcement (Edge Function)

All status mutations must go through the `/order-state-change` Edge Function. Never allow direct SQL `UPDATE` from the client on `orders.status`.

```typescript
// supabase/functions/order-state-change/index.ts (pseudocode outline)

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_request:     ['specialist_approved', 'rejected'],
  specialist_approved: ['shop_confirmed', 'cancelled'],
  shop_confirmed:      ['in_progress'],
  in_progress:         ['packaged'],
  packaged:            ['ready_for_courier'],
  ready_for_courier:   ['in_transit'],
  in_transit:          ['delivered'],
  delivered:           [],
  rejected:            [],
  cancelled:           [],
};

// On each transition, also:
// 1. Validate the calling user's role is permitted to make this specific transition
// 2. Timestamp the relevant *_at column
// 3. Trigger the correct FCM push notifications (see Section 13)
// 4. On 'delivered': call the receipt generation function
// 5. On 'shop_confirmed': simultaneously push to Courier queue
```

---

## 8. Two-Way Handshake — Full Technical Flow

### 8.1 Step-by-Step with System Actions

**Step 1 — Shop Submits Request**
- Actor: `foh_manager` or `kitchen_manager`
- UI: Cart screen → "Submit Request" button
- System actions:
  1. Validate cut-off time server-side (reject if past 4:00 PM for target date)
  2. Validate lead times for each product in cart
  3. Insert `orders` record with `status = 'pending_request'`
  4. Insert all `order_items` and `order_item_modifiers`
  5. Determine `assigned_specialist` based on product categories in the cart
  6. **NOTE:** If the cart spans multiple categories (e.g., Meat + Pastry), split into separate `orders` rows — one per specialist. A single shop submission may create multiple order records.
  7. Send FCM push notification to the relevant specialist(s)

**Step 2 — Specialist Reviews & Approves**
- Actor: `meat_specialist`, `bread_baker`, or `pastry_chef`
- UI: Inbox screen → tap order → "Approve & Quote"
- System actions:
  1. Validate calling user's role owns the product categories in this order
  2. (Optional) Specialist may set `unit_cost` on each `order_item` at this stage
  3. Transition `status` → `specialist_approved`, set `specialist_approved_at`
  4. Send FCM push notification back to the originating Shop

**Step 3 — Shop Final Confirm**
- Actor: The same `foh_manager` or `kitchen_manager` who submitted
- UI: "Awaiting Confirmation" screen → review → "Final Confirm"
- System actions:
  1. Transition `status` → `shop_confirmed`, set `shop_confirmed_at`
  2. **Simultaneously trigger two actions:**
     - Move order into Specialist's To-Do Board (Specialist's UI query filter changes)
     - Append order to the active Courier manifest for the target delivery date
  3. Send FCM push notification to Specialist (new item on board)
  4. Send FCM push notification to Courier (new delivery queued)

**Step 4 — Production (Specialist Updates State)**
- Actor: `meat_specialist`, `bread_baker`, or `pastry_chef`
- UI: To-Do Board → tap order → update state chips
- States: `in_progress` → `packaged` → `ready_for_courier`
- On `ready_for_courier`: FCM to Courier

**Step 5 — Delivery Sign-off**
- Actor: `courier` initiates; `foh_manager` or `kitchen_manager` completes
- UI: Courier taps "Delivered" → Shop sees sign-off screen → taps "Received & Confirmed"
- System actions:
  1. Transition `status` → `delivered`
  2. Record `signed_off_by`, `signed_off_at` on `manifest_stops`
  3. Invoke `generate-receipt` Edge Function (async, non-blocking)
  4. Send FCM to Admin with receipt notification

### 8.2 Split-Order Behaviour (Multi-Category Cart)

When a Shop submits a cart with items from both the Meat and Pastry categories:
- The system creates **two separate `orders` records**, each with the appropriate `assigned_specialist`.
- Both orders share the same `requested_delivery_date` and `submitted_by`.
- Both are bundled into the same Courier manifest stop for that Shop.
- The Shop sees them as a grouped submission in their UI ("Your Tuesday Request — 2 Orders").
- Both orders must reach `ready_for_courier` before the Courier stop is considered complete.

---

## 9. Product Catalog Architecture

### 9.1 Catalog Structure (3-Level Hierarchy)

```
Category (production zone)
  └── Product (base item)
        ├── Modifier Group (required or optional)
        │     └── Modifier Option (selectable value)
        └── Modifier Group 2
              └── Modifier Option
```

**Example — Lamb:**
```
Category:  Meat
Product:   Lamb
  Modifier Group: Cut (required)
    Options: Leg / Shoulder / Chops / Minced
  Modifier Group: Prep State (required)
    Options: Raw / Marinated / Fully Cooked / Sous-Vide
```

**Example — Sourdough Loaf:**
```
Category:  Bread
Product:   Sourdough Loaf
  lead_time_hours: 48   ← 2-day minimum enforced by system
  Modifier Group: Size (required)
    Options: Standard / Large
  Modifier Group: Crust (optional)
    Options: Soft / Standard / Extra Crispy
```

### 9.2 Lead Time Enforcement Logic

Executed in the Edge Function when a cart is submitted. Never trusted from the client.

```typescript
// For each item in the cart:
const product = await getProduct(item.product_id);
const now = serverTime();  // UTC — never client time
const cutoffToday = getCutoffTime(now);  // 4:00 PM today

let earliestPickupTime: Date;

if (now < cutoffToday) {
  // Order placed before cut-off: first valid slot is tomorrow + lead time
  earliestPickupTime = addHours(startOfTomorrow(now), product.lead_time_hours);
} else {
  // Order placed after cut-off: push to day-after-tomorrow + lead time
  earliestPickupTime = addHours(startOfDayAfterTomorrow(now), product.lead_time_hours);
}

if (requestedDeliveryDate < dateOnly(earliestPickupTime)) {
  throw new OrderValidationError(
    `${product.name} requires ${product.lead_time_hours}h lead time. 
     Earliest available delivery: ${formatDate(earliestPickupTime)}`
  );
}
```

### 9.3 The "86" Protocol (Out of Stock)

When a Hub Specialist marks a product as `is_available = FALSE`:

1. Supabase Realtime broadcasts the change to all connected Shop App instances
2. The product is immediately hidden from the Shop catalog (RLS policy filters `is_available = FALSE` for shop roles)
3. FCM push notification sent to all active `foh_manager` and `kitchen_manager` accounts: *"[Product Name] is currently out of stock at the Hub. Adjust your orders accordingly."*
4. Any `pending_request` orders containing this item are flagged with a warning banner in the Shop's request history
5. The Admin receives a log entry
6. When the Specialist re-enables availability, Realtime broadcasts the restore and FCM re-notifies shops

---

## 10. Timing Protocols & Cut-off Logic

### 10.1 The Universal Cut-off

- Default time: **4:00 PM** (London time, `Europe/London`)
- Configurable by Admin via `cutoff_config` table — but only future-dated changes are allowed
- All evaluations use **server time** from `cutoff_config.timezone`. Client clock is never trusted.
- The Shop app fetches the current cutoff from the server on launch and on foreground resume

### 10.2 Countdown Timer Logic (Shop App)

The persistent countdown banner on the Shop App must:
1. Fetch server time on app launch and calculate offset vs device time
2. Use the server-calculated offset for all local countdown rendering
3. Re-sync server time every 15 minutes in the background
4. When countdown reaches 0, immediately disable "Submit Request" for any items targeting the next valid day
5. Show the next valid delivery window in the banner: *"⏳ 1h 45m left for tomorrow's orders / Next window: Wednesday"*

### 10.3 Delivery Date Picker Rules (Shop App)

The date picker in the cart must enforce these rules before the user can select a date:

- No dates in the past
- Today is never selectable (Hub needs prep time)
- Dates that don't satisfy lead time for ANY item in the current cart are greyed out with a tooltip
- Weekends / non-operational days are configurable by Admin (stored in `cutoff_config`)

---

## 11. Operational Dashboards — Screen-by-Screen Spec

### 11.1 Shop App Screens

**A. Home / Dashboard**
- Countdown timer banner (always visible, persistent)
- List of today's active orders and their current statuses
- Quick-access buttons: "New Request" and "My Templates"
- Badge notification on any order requiring Shop action (e.g., awaiting Final Confirm)

**B. Catalog / New Request**
- Browse by Category → Product → Modifiers (mandatory modifiers block progression)
- Quantity input with unit displayed
- Custom note text field (max 200 chars)
- Running cart total (item count, not cost — cost is set by Specialist)
- Cart validates delivery date availability per lead time before submission

**C. My Templates**
- List of saved order templates, labelled by name
- "Order Now" button triggers the lead time + cut-off validation, then submits instantly
- "Edit Template" allows adding/removing items
- Templates are role-scoped (FOH Manager's templates only show FOH catalog items)

**D. Order History & Tracking**
- Timeline view per order showing status transitions with timestamps
- Status badge colour-coded:
  - Yellow: `pending_request` / `specialist_approved`
  - Blue: `shop_confirmed` / `in_progress` / `packaged`
  - Orange: `ready_for_courier` / `in_transit`
  - Green: `delivered`
  - Red: `rejected` / `cancelled`

**E. Delivery Sign-off Screen**
- Triggered when an order transitions to `in_transit` (pushed via Realtime)
- Lists items in the delivery for the Shop to verify
- "Confirm Receipt" button + optional signature capture
- Cannot be dismissed without confirming or flagging a discrepancy

### 11.2 Hub App Screens (Specialists)

**A. Inbox (Pending Requests)**
- List of all `pending_request` orders assigned to this specialist's category
- Each card shows: Shop name, items requested, delivery date, time since submission
- Sort by urgency (delivery date ASC)
- Tap to expand: view full item list with modifiers and custom notes
- Actions: "Approve & Quote" (sets optional unit costs) or "Reject" (requires rejection reason text)

**B. To-Do Board (Active Production)**
- Digital ticket rail — cards move left-to-right through production states
- Columns: `shop_confirmed` | `in_progress` | `packaged` | `ready_for_courier`
- Each card: Shop name, items, delivery date
- Colour urgency coding:
  - Red card: Delivery is today
  - Amber card: Delivery is tomorrow
  - Green card: Delivery in 2+ days
- "86" button accessible per product via a long-press menu from any card

**C. Courier Screens**
- **Today's Manifest:** List of stops for today, ordered by optimized route
- Each stop shows: Shop name, address, items to deliver, ETA
- "Start Route" button opens Google Maps with optimized waypoints
- At each stop: "Confirm Arrival" → hand-off checklist → trigger Shop's sign-off screen
- Cannot mark stop complete until Shop has confirmed receipt

### 11.3 Admin Web Dashboard (Next.js)

**A. Live Operations Overview**
- Real-time Kanban of all active orders across all shops and specialists
- Filterable by: Shop, Specialist, Status, Delivery Date
- Click through to full order detail

**B. Catalog Management**
- Full CRUD on Categories, Products, Modifier Groups, Modifier Options
- Set lead times and activate/deactivate products
- View all current "86" items with timestamps

**C. Financial Reports**
- Per-Shop monthly summary table
- Download buttons for PDF receipts (individual and batch)
- Cost trend charts (Recharts or similar)
- Export to CSV

**D. User Management**
- View all 19 profiles, their roles, and last-login timestamps
- Activate / deactivate accounts
- Reset FCM tokens

---

## 12. Automated Accounting & Receipts

### 12.1 Daily Dispatch Receipt

**Trigger:** `orders.status` transitions to `delivered`.

**Execution:** Async Edge Function `generate-receipt`. Non-blocking — the sign-off UI does not wait for PDF generation to complete.

**PDF Receipt Fields:**
```
HubSync — Internal Dispatch Receipt
──────────────────────────────────────────────────────
Receipt #:        [receipt.id — last 8 chars, uppercase]
Date Issued:      [delivered_at, formatted: DD MMM YYYY HH:mm]
Shop:             [shop.name]
Delivery Date:    [orders.requested_delivery_date]
──────────────────────────────────────────────────────
ITEMS DELIVERED:
  [product.name] [modifier values] × [quantity] [unit]  £[unit_cost × qty]
  ...
──────────────────────────────────────────────────────
TOTAL:            £[sum of all line items]
──────────────────────────────────────────────────────
Received by:      [signed_off_by profile name]
Signature:        [signature image if captured]
Courier:          [courier profile name]
──────────────────────────────────────────────────────
This is an internal transfer record. Not a VAT invoice.
```

**Storage:** PDF saved to Supabase Storage at path: `receipts/{year}/{month}/{shop_id}/{receipt_id}.pdf`

**Notification:** Admin receives FCM + email (via Supabase Auth's email hook) with a link to the receipt.

### 12.2 Monthly Aggregation

**Trigger:** Supabase Cron Job running at `00:01` on the 1st of each month.

**Edge Function:** `generate-monthly-statement`

**Logic:**
1. For each active `shop_id`:
2. Query all `receipts` where `period_month` = previous month and `shop_id` = current shop
3. Render a summary PDF with an itemized breakdown by week, product category, and total
4. Store at: `receipts/{year}/{month}/{shop_id}/MONTHLY_SUMMARY.pdf`
5. Insert a record in `receipts` with `is_monthly_summary = TRUE`
6. Send FCM + email to Admin

---

## 13. Notification Architecture

All push notifications go through Firebase Cloud Messaging. FCM tokens are stored in `profiles.fcm_token` and updated on every login.

| Event | Trigger | Recipient | Message |
|---|---|---|---|
| New request submitted | `status = pending_request` | Assigned Specialist | *"New [category] request from [Shop Name] for [delivery date]"* |
| Specialist approved | `status = specialist_approved` | Originating Shop Manager | *"Your request has been approved. Tap to Final Confirm."* |
| Specialist rejected | `status = rejected` | Originating Shop Manager | *"Your [item] request was rejected: [reason]"* |
| Final Confirm complete | `status = shop_confirmed` | Specialist + Courier | *"Order confirmed — added to your board / manifest."* |
| Order ready for courier | `status = ready_for_courier` | Courier | *"[N] items from [Shop Name] are packaged and ready."* |
| Courier in transit | `status = in_transit` | Shop Manager | *"Your delivery is on the way — ETA [time]."* |
| Delivery sign-off needed | Courier arrives at stop | Shop Manager | *"[Courier name] has arrived. Please confirm receipt in the app."* |
| 86 toggle activated | `products.is_available = FALSE` | All FOH + Kitchen Managers | *"[Product Name] is now out of stock. Adjust your orders."* |
| Approaching cut-off | Cron: 30 min before 4:00 PM | All FOH + Kitchen Managers with no confirmed order for tomorrow | *"⏰ 30 minutes left to place tomorrow's orders."* |
| Receipt generated | `delivered` event | Admin | *"Dispatch receipt ready: [Shop Name] — [date]."* |

---

## 14. Offline Mode Strategy

**Decision (resolved):** Read-only cache. Shops cannot submit new Requests or Final Confirm while offline. They can view their order history and confirmed order status.

**Implementation (Drift / SQLite):**

The Shop App caches the following locally:
- Last 30 days of `orders` for the current Shop
- Current product catalog (refreshed on app foreground)
- Current `cutoff_config`

**Sync strategy:**
1. On app launch: fetch fresh data from Supabase, write to Drift
2. On foreground resume: refresh order statuses and product catalog
3. Supabase Realtime subscription: live updates to order status while online
4. If offline: Drift serves the cached data with a persistent "You are offline — read-only mode" banner
5. Action buttons (Submit, Confirm) are disabled when offline with tooltip: *"An internet connection is required to submit orders."*

**Hub App (Specialists):** No offline mode. Hub has a fixed internet connection. If connectivity drops, show an error screen and block interactions to prevent state corruption.

---

## 15. Security Model

### 15.1 Authentication
- Supabase Auth with email/password. No SSO, no OAuth for v1.
- JWTs contain `role` and `shop_id` as custom claims (set in the Auth hook)
- JWT expiry: 1 hour, auto-refreshed by Supabase SDK
- No public sign-up endpoint. Accounts are created by Admin only via the Admin Web dashboard

### 15.2 Authorization Layers (Defence in Depth)

```
Layer 1: Flutter/Next.js UI     — hides irrelevant UI elements per role
Layer 2: Edge Function          — validates role before processing any mutation
Layer 3: Supabase RLS           — database-level row filtering (non-bypassable)
```

All three must agree. If Layer 3 blocks something Layer 2 allowed, it means Layer 2 has a bug — fix it.

### 15.3 Secrets Management
- No secrets committed to Git. Ever.
- Supabase keys, FCM server key, Google Maps API key stored as:
  - Local dev: `.env.local` (gitignored)
  - Staging/Prod: Supabase Edge Function secrets + GitHub Actions secrets

### 15.4 Audit Logging (Admin visibility)
All `orders` status transitions are timestamped on the order record itself. For a full audit trail, the Admin can query:
```sql
SELECT id, status, submitted_at, specialist_approved_at, shop_confirmed_at,
       packaged_at, ready_at, delivered_at, assigned_specialist, assigned_courier
FROM orders
WHERE shop_id = '[shop]' AND requested_delivery_date = '[date]'
ORDER BY submitted_at;
```

---

## 16. Open Architectural Decisions (With Recommendations)

These were marked as unresolved in v1. Decisions needed before writing affected code.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| D1 | **Courier device ownership** | Company-issued Android tablet (shared login) | Prevents FCM token conflicts from multiple devices; enables background GPS without personal data concerns. |
| D2 | **Offline sync strategy** | Read-only cache (Drift). Confirmed above in Section 14. | Simplest correct model for v1. Optimistic updates add complexity without meaningful benefit for a Hub-dependent system. |
| D3 | **Third-party delivery fallback** | Out of scope for v1. Revisit in v1.1 if requested. | Adds a webhook integration to an external logistics API. Too many unknowns to spec correctly now. |
| D4 | **Thermal printer for Hub labels** | Out of scope for v1. Design the `packaged` state to carry a `label_data` JSON field, so printing can be added later without a migration. | Zebra/Star Micronics Bluetooth APIs vary by device. Spec it cleanly in v1.1 once hardware is confirmed. |

**ACTION REQUIRED before dev starts:** Confirm D1 with the business owner. The Courier FCM architecture depends on it.

---

## 17. Development Workflow

### 17.1 Git Strategy

```
main            ← protected. CI/CD deploys to prod on merge. No direct pushes.
staging         ← protected. Deploys to staging. PRs merged here first.
dev             ← integration branch. All feature work merges here.
feature/{name}  ← individual feature branches (e.g., feature/two-way-handshake)
fix/{name}      ← bug fix branches
```

**PR Rules:**
- Every PR must target `dev` (unless it's a hotfix targeting `staging`)
- PRs require 1 reviewer approval
- PR description must reference the spec section it implements (e.g., *"Implements Section 8 — Two-Way Handshake"*)
- If the PR changes any system behaviour described in `PROJECT_SPEC.md`, the spec must be updated in the same PR

### 17.2 Environment Variables Template

```bash
# .env.example — copy to .env.local, fill in values, never commit .env.local

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key     # Edge Functions only

# Firebase (Server)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Google Maps
GOOGLE_MAPS_API_KEY=your-maps-key

# Environment flag
APP_ENV=dev   # dev | staging | prod
```

### 17.3 Testing Requirements

| Area | Type | Minimum coverage |
|---|---|---|
| Order state machine transitions | Unit tests | All valid transitions + all invalid transitions must throw |
| Lead time validation logic | Unit tests | Boundary conditions: before cut-off, after cut-off, exact lead-time edge |
| RLS policies | Integration tests (Supabase local) | Each role attempting to read/write data it should not have access to |
| Two-Way Handshake flow | Integration tests | Full happy path from submission to delivery |
| 86 protocol propagation | Integration tests | Toggle → verify product disappears from Shop catalog |
| PDF receipt generation | Snapshot tests | Known input → known PDF output structure |

Run locally: `supabase start` → `flutter test` → `npm test`

### 17.4 Database Migrations

```bash
# Create a new migration
supabase migration new <name>

# Apply locally
supabase db reset

# Apply to staging (via CI only — never run manually against prod)
supabase db push --linked
```

---

## 18. Phase 2 — AI Predictive Layer

### 18.1 Data We Must Capture in v1 (Non-Negotiable)

Every v1 transaction must log the following precisely for the AI model to be meaningful:

| Data Point | Where stored | Why needed |
|---|---|---|
| Order quantity per product per Shop | `order_items` | Baseline consumption model |
| Day of week of each order | Derivable from `requested_delivery_date` | Weekday pattern detection |
| Timestamps of each order submission | `orders.submitted_at` | Identify ordering behaviour patterns |
| Delivery date vs submission date delta | Derivable | Lead time usage analysis |
| 86 events with timestamps | `products.updated_at` + audit log | Stockout frequency analysis |
| Shop location coordinates | `shops.address` → geocoded | Correlated with weather/event radius |

### 18.2 Phase 2 Smart Suggestion Design

After 6–12 months of data:

1. **Baseline model:** 8-week trailing average per `(shop_id, product_id, day_of_week)`
2. **Weather overlay:** OpenWeather API correlation per Shop location
3. **Events overlay:** Ticketmaster / PredictHQ API for local events within 2km of each Shop
4. **Output:** When a Shop Manager opens the New Request screen, auto-fill the cart with suggested quantities. Display a transparent explanation:
   > *"Suggested based on your Tuesday average (12kg), adjusted for tomorrow's sunny forecast (+10%) and nearby festival (+15%). Adjust freely."*

---

## 19. Glossary

| Term | Definition |
|---|---|
| **Shop** | One of the 7 satellite café locations that submit supply requests |
| **Hub** | The central production facility that fulfils orders |
| **Request** | A shop's unconfirmed submission, before both approvals are complete |
| **Order** | A confirmed supply transaction, after Final Confirm |
| **Two-Way Handshake** | The mandatory dual-approval flow (Specialist → Shop) before an order becomes active |
| **86** | Industry term for "out of stock." The 86 toggle removes a product from all Shop catalogs instantly |
| **Manifest** | The Courier's compiled list of delivery stops for a given day |
| **Lead Time** | The minimum number of hours between order submission and a valid delivery date for a given product |
| **Cut-off** | The daily deadline (default 4:00 PM) after which new requests cannot target the following day |
| **Final Confirm** | The Shop's second-stage approval that locks the order and triggers simultaneous routing |
| **To-Do Board** | The Specialist's production dashboard showing all confirmed, in-flight orders |
| **Inbox** | The Specialist's staging area showing pending requests awaiting their Approval 1 |
| **RLS** | Row-Level Security — PostgreSQL's mechanism for filtering rows at the database level per user |
| **RBAC** | Role-Based Access Control — the permission system governing what each role can see and do |
| **FCM** | Firebase Cloud Messaging — the push notification service |
| **Edge Function** | A serverless function hosted on Supabase's infrastructure, used for business logic that cannot run client-side |
