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
}

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

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
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("product_categories").select("id,name,assigned_role").order("display_order"),
      supabase
        .from("products")
        .select("id,name,unit,lead_time_hours,is_available,category_id,price")
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

  async function toggle86(p: Product) {
    if (p.is_available && !confirm(`Are you sure you want to 86 ${p.name}? It will be unavailable to order.`)) return;
    const { error } = await createClient()
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_available ? `${p.name} marked 86` : `${p.name} restored`);
    await load();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Are you sure you want to delete ${p.name}?`)) return;
    const { error } = await createClient().from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} deleted`);
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Products grouped by category. Set prices here — they drive every order.
          </p>
        </div>
        <div className="flex gap-2">
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
                      {categories.map((c) => (
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

      {categories.map((c) => {
        const prods = products.filter((p) => p.category_id === c.id);
        return (
          <Card key={c.id}>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant="outline">{roleLabel(c.assigned_role)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{prods.length} products</p>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Lead (h)</TableHead>
                    <TableHead>Price (£)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell className="tabular-nums">{p.lead_time_hours}</TableCell>
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
                        {p.is_available ? (
                          <Badge variant="secondary">Available</Badge>
                        ) : (
                          <Badge variant="destructive">86&apos;d</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void toggle86(p)} className="mr-2">
                          {p.is_available ? "86 it" : "Restore"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void deleteProduct(p)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {prods.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                        No products in this category.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
