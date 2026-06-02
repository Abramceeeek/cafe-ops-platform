"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ROADMAP 1.4 — v0 catalog management (functional, not polished).
// Runtime needs a live Supabase + admin session; build/lint verifiable now.

interface Category {
  id: string;
  name: string;
  assigned_role: string;
}
interface Product {
  id: string;
  name: string;
  unit: string;
  lead_time_hours: number;
  is_available: boolean;
  category_id: string;
}

const ASSIGNABLE_ROLES = [
  "meat_specialist",
  "bread_baker",
  "pastry_chef",
  "admin",
];

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  // category form
  const [catName, setCatName] = useState("");
  const [catRole, setCatRole] = useState(ASSIGNABLE_ROLES[0]);

  // product form
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("");
  const [prodUnit, setProdUnit] = useState("kg");
  const [prodLead, setProdLead] = useState(24);

  async function load() {
    const supabase = createClient();
    const { data: cats, error: cErr } = await supabase
      .from("product_categories")
      .select("id,name,assigned_role")
      .order("display_order");
    const { data: prods, error: pErr } = await supabase
      .from("products")
      .select("id,name,unit,lead_time_hours,is_available,category_id")
      .order("name");
    if (cErr || pErr) {
      setError(cErr?.message ?? pErr?.message ?? "Load failed");
      return;
    }
    setCategories(cats ?? []);
    setProducts(prods ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error: err } = await supabase
      .from("product_categories")
      .insert({ name: catName, assigned_role: catRole });
    if (err) return setError(err.message);
    setCatName("");
    await load();
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error: err } = await supabase.from("products").insert({
      name: prodName,
      category_id: prodCat,
      unit: prodUnit,
      lead_time_hours: prodLead,
    });
    if (err) return setError(err.message);
    setProdName("");
    await load();
  }

  async function toggle86(p: Product) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (err) return setError(err.message);
    await load();
  }

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 880, margin: "6vh auto", padding: 16 }}>
      <p>
        <Link href="/">← Dashboard</Link>
      </p>
      <h1>Catalog</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section>
        <h2>Products</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Lead (h)</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{categoryName(p.category_id)}</td>
                <td>{p.unit}</td>
                <td>{p.lead_time_hours}</td>
                <td>
                  <button type="button" onClick={() => void toggle86(p)}>
                    {p.is_available ? "Available — 86 it" : "86'd — restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ display: "flex", gap: 32, marginTop: 24 }}>
        <form onSubmit={addProduct}>
          <h3>Add product</h3>
          <input
            placeholder="Name"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />
          <select
            value={prodCat}
            onChange={(e) => setProdCat(e.target.value)}
            required
          >
            <option value="" disabled>
              Category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Unit"
            value={prodUnit}
            onChange={(e) => setProdUnit(e.target.value)}
            required
          />
          <input
            type="number"
            min={0}
            value={prodLead}
            onChange={(e) => setProdLead(Number(e.target.value))}
          />
          <button type="submit">Add</button>
        </form>

        <form onSubmit={addCategory}>
          <h3>Add category</h3>
          <input
            placeholder="Name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <select value={catRole} onChange={(e) => setCatRole(e.target.value)}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit">Add</button>
        </form>
      </section>
    </main>
  );
}
