"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} staff profiles.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
