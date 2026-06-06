"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, UserPlus, ShieldAlert, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { createUser, updateUserStatus } from "@/app/actions/users";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  shop_id: string | null;
}
interface Shop {
  id: string;
  name: string;
}

const ROLES = [
  "admin",
  "meat_specialist",
  "bread_baker",
  "pastry_chef",
  "foh_manager",
  "kitchen_manager",
  "courier",
];

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [shopId, setShopId] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role,is_active,shop_id").order("role"),
      supabase.from("shops").select("id,name"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setShops((s ?? []) as Shop[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shopName = (id: string | null) => (id ? shops.find((s) => s.id === id)?.name ?? "—" : "—");

  const handleCreate = async () => {
    if (!email || !fullName || !role) return;
    setLoading(true);
    const res = await createUser({
      email,
      full_name: fullName,
      role,
      shop_id: shopId || undefined,
    });
    setLoading(false);
    if (res.ok) {
      setTempPassword(res.tempPassword || null);
      void load();
    } else {
      alert("Error: " + res.error + " - " + res.details);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this user?`)) return;
    const res = await updateUserStatus(userId, !currentStatus);
    if (res.ok) {
      void load();
    } else {
      alert("Error: " + res.error + " - " + res.details);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} staff profiles.</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) setTempPassword(null); }}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-2" /> Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Staff User</DialogTitle>
              </DialogHeader>
              {tempPassword ? (
                <div className="space-y-4 pt-4">
                  <div className="rounded-md bg-green-50 p-4 border border-green-200">
                    <p className="text-sm font-medium text-green-800">User created successfully!</p>
                    <p className="mt-2 text-sm text-green-700">Please provide the following temporary password to the user. They can change it after logging in.</p>
                    <div className="mt-3 bg-white px-3 py-2 border rounded font-mono text-center text-lg">{tempPassword}</div>
                  </div>
                  <Button className="w-full" onClick={() => setIsOpen(false)}>Done</Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Shop (if applicable)</label>
                    <Select value={shopId} onValueChange={setShopId}>
                      <SelectTrigger><SelectValue placeholder="No shop (HQ)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (HQ)</SelectItem>
                        {shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={() => void handleCreate()} disabled={loading}>
                    Create User
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.role}</TableCell>
                  <TableCell>{shopName(p.shop_id)}</TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={p.is_active ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"}
                      onClick={() => void handleToggleActive(p.id, p.is_active)}
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
