"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { roleLabel, CATEGORY_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  price: number | null;
  archived_at: string | null;
  unavailable_note: string | null;
}

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [unitEdits, setUnitEdits] = useState<Record<string, string>>({});
  const [leadEdits, setLeadEdits] = useState<Record<string, string>>({});
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});

  // forms
  const [catName, setCatName] = useState("");
  const [catRole, setCatRole] = useState(CATEGORY_ROLES[0]);
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("");
  const [prodUnit, setProdUnit] = useState("kg");
  const [prodLead, setProdLead] = useState(24);
  const [prodPrice, setProdPrice] = useState("");

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((p?.role as string) ?? "");
    }
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("product_categories").select("id,name,assigned_role").order("display_order"),
      supabase
        .from("products")
        .select("id,name,unit,lead_time_hours,is_available,category_id,price,archived_at,unavailable_note")
        .order("name"),
    ]);
    setCategories(cats ?? []);
    setProducts(prods ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    const { error } = await createClient()
      .from("product_categories")
      .insert({ name: catName, assigned_role: catRole });
    if (error) return toast.error(error.message);
    toast.success(`Category “${catName}” added`);
    setCatName("");
    setCategoryOpen(false);
    await load();
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    if (!prodCat) return toast.error("Choose a category");
    const { error } = await createClient().from("products").insert({
      name: prodName,
      category_id: prodCat,
      unit: prodUnit,
      lead_time_hours: prodLead,
      price: prodPrice === "" ? null : parseFloat(prodPrice),
    });
    if (error) return toast.error(error.message);
    toast.success(`Product “${prodName}” added`);
    setProdName("");
    setProdPrice("");
    setProductOpen(false);
    await load();
  }

  async function savePrice(p: Product) {
    const raw = priceEdits[p.id];
    if (raw == null) return;
    const val = raw === "" ? null : parseFloat(raw);
    if (val != null && (isNaN(val) || val < 0)) return toast.error("Invalid price");
    if (val === (p.price ?? null)) {
      setPriceEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
      return;
    }
    const { error } = await createClient().from("products").update({ price: val }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} price updated`);
    setPriceEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
    await load();
  }

  async function saveName(p: Product) {
    const raw = nameEdits[p.id];
    if (raw == null) return;
    const val = raw.trim();
    const clear = () => setNameEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
    if (val === "") return toast.error("Name can't be empty");
    if (val === p.name) return clear();
    const { error } = await createClient().from("products").update({ name: val }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`Renamed to “${val}”`);
    clear();
    await load();
  }

  async function saveUnit(p: Product) {
    const raw = unitEdits[p.id];
    if (raw == null) return;
    const val = raw.trim();
    const clear = () => setUnitEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
    if (val === "") return toast.error("Unit can't be empty");
    if (val === p.unit) return clear();
    const { error } = await createClient().from("products").update({ unit: val }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} now measured in ${val}`);
    clear();
    await load();
  }

  async function saveLead(p: Product) {
    const raw = leadEdits[p.id];
    if (raw == null) return;
    const val = parseInt(raw, 10);
    const clear = () => setLeadEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
    if (isNaN(val) || val < 0) return toast.error("Lead time must be 0 or more hours");
    if (val === p.lead_time_hours) return clear();
    const { error } = await createClient().from("products").update({ lead_time_hours: val }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} lead time set to ${val}h`);
    clear();
    await load();
  }

  async function saveNote(p: Product) {
    const raw = noteEdits[p.id];
    if (raw == null) return;
    const val = raw.trim();
    const clear = () => setNoteEdits((m) => { const n = { ...m }; delete n[p.id]; return n; });
    if (val === (p.unavailable_note ?? "")) return clear();
    const { error } = await createClient()
      .from("products")
      .update({ unavailable_note: val === "" ? null : val })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} note saved`);
    clear();
    await load();
  }

  // Moving a product between zones. RLS only lets a specialist land it in a
  // category assigned to their own role, and the dropdown offers no others.
  async function saveCategory(p: Product, categoryId: string) {
    if (categoryId === p.category_id) return;
    const { error } = await createClient()
      .from("products")
      .update({ category_id: categoryId })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} moved to ${categories.find((c) => c.id === categoryId)?.name ?? "category"}`);
    await load();
  }

  async function toggle86(p: Product) {
    if (p.is_available && !confirm(`Are you sure you want to mark ${p.name} as out of stock? It will be unavailable to order.`)) return;
    const { error } = await createClient()
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_available ? `${p.name} marked out of stock` : `${p.name} restored`);
    await load();
  }

  // Products that have ever been ordered can't be removed from the table (order
  // history references them), so archive_product deletes the never-ordered ones
  // outright and archives the rest — clearing them out of standing orders and
  // templates either way. Order history is never touched.
  async function deleteProduct(p: Product) {
    if (
      !confirm(
        `Delete ${p.name}? It disappears from the catalog and from every shop's ordering list. Past orders keep it.`,
      )
    )
      return;
    const { data, error } = await createClient().rpc("archive_product", { p_product_id: p.id });
    if (error) return toast.error(error.message);
    const res = (data ?? {}) as {
      action?: string;
      order_items?: number;
      standing_orders_cleared?: number;
    };
    const cleared = res.standing_orders_cleared
      ? `, removed from ${res.standing_orders_cleared} standing-order line${res.standing_orders_cleared === 1 ? "" : "s"}`
      : "";
    toast.success(
      res.action === "deleted"
        ? `${p.name} deleted${cleared}`
        : `${p.name} archived — kept on ${res.order_items} past order line${res.order_items === 1 ? "" : "s"}${cleared}`,
    );
    await load();
  }

  async function restoreProduct(p: Product) {
    const { error } = await createClient().rpc("restore_product", { p_product_id: p.id });
    if (error) return toast.error(error.message);
    toast.success(`${p.name} restored — available to order again`);
    await load();
  }

  // Admin sees the whole catalog; a specialist (Pitmaster/Baker) manages only the
  // products in their own categories. RLS enforces the same scoping server-side.
  const isAdmin = role === "admin";
  const visibleCategories = isAdmin ? categories : categories.filter((c) => c.assigned_role === role);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Products grouped by category. Set prices here — they drive every order."
              : "Your items — add, price, and remove. Prices drive every order, so keep them current."}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4" /> Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add category</DialogTitle>
                <DialogDescription>A production zone owned by a Hub specialist.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="catName">Name</Label>
                  <Input id="catName" value={catName} onChange={(e) => setCatName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Assigned role</Label>
                  <Select value={catRole} onValueChange={setCatRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit">Add category</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}

          <Dialog open={productOpen} onOpenChange={setProductOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add product</DialogTitle>
                <DialogDescription>Add an item to a category.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addProduct} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prodName">Name</Label>
                  <Input id="prodName" value={prodName} onChange={(e) => setProdName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={prodCat} onValueChange={setProdCat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="prodUnit">Unit</Label>
                    <Input id="prodUnit" value={prodUnit} onChange={(e) => setProdUnit(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prodLead">Lead (h)</Label>
                    <Input
                      id="prodLead"
                      type="number"
                      min={0}
                      value={prodLead}
                      onChange={(e) => setProdLead(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prodPrice">Price (£)</Label>
                    <Input
                      id="prodPrice"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Add product</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {visibleCategories.map((c) => {
        const inCategory = products.filter((p) => p.category_id === c.id);
        const prods = inCategory.filter((p) => !p.archived_at);
        const archived = inCategory.filter((p) => p.archived_at);
        return (
          <Card key={c.id}>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant="outline">{roleLabel(c.assigned_role)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{prods.length} products</p>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-auto pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Lead (h)</TableHead>
                    <TableHead>Price (£)</TableHead>
                    <TableHead>Out-of-stock note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Input
                          className="h-8 w-44"
                          value={nameEdits[p.id] ?? p.name}
                          onChange={(e) => setNameEdits((m) => ({ ...m, [p.id]: e.target.value }))}
                          onBlur={() => { if (nameEdits[p.id] != null) void saveName(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={p.category_id} onValueChange={(v) => void saveCategory(p, v)}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleCategories.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20"
                          value={unitEdits[p.id] ?? p.unit}
                          onChange={(e) => setUnitEdits((m) => ({ ...m, [p.id]: e.target.value }))}
                          onBlur={() => { if (unitEdits[p.id] != null) void saveUnit(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          inputMode="numeric"
                          className="h-8 w-16 tabular-nums"
                          value={leadEdits[p.id] ?? String(p.lead_time_hours)}
                          onChange={(e) =>
                            setLeadEdits((m) => ({ ...m, [p.id]: e.target.value.replace(/[^0-9]/g, "") }))
                          }
                          onBlur={() => { if (leadEdits[p.id] != null) void saveLead(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          inputMode="decimal"
                          placeholder="—"
                          className="h-8 w-20 tabular-nums"
                          value={priceEdits[p.id] ?? (p.price != null ? String(p.price) : "")}
                          onChange={(e) =>
                            setPriceEdits((m) => ({ ...m, [p.id]: e.target.value.replace(/[^0-9.]/g, "") }))
                          }
                          onBlur={() => { if (priceEdits[p.id] != null) void savePrice(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Why it’s off…"
                          className="h-8 w-40"
                          value={noteEdits[p.id] ?? (p.unavailable_note ?? "")}
                          onChange={(e) => setNoteEdits((m) => ({ ...m, [p.id]: e.target.value }))}
                          onBlur={() => { if (noteEdits[p.id] != null) void saveNote(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        {p.is_available ? (
                          <Badge variant="secondary">Available</Badge>
                        ) : (
                          <Badge variant="destructive">Out of Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void toggle86(p)} className="mr-2">
                          {p.is_available ? "Mark Out of Stock" : "Restore"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void deleteProduct(p)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {prods.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                        No products in this category.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {archived.length > 0 && (
                <details className="rounded-md border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Archived ({archived.length})
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Removed from ordering but kept on past orders. Restore puts one back on the list.
                  </p>
                  <ul className="mt-2 divide-y">
                    {archived.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-2">
                        <span className="text-sm">
                          {p.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.unit} · {p.price != null ? `£${p.price}` : "no price"} · {p.lead_time_hours}h
                          </span>
                        </span>
                        <Button variant="outline" size="sm" onClick={() => void restoreProduct(p)}>
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
