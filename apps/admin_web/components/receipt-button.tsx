"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ReceiptButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    const { data, error } = await createClient().functions.invoke("get-receipt", {
      body: { order_id: orderId },
    });
    setLoading(false);
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) return toast.error("Receipt not ready yet.");
    window.open(url, "_blank", "noopener");
  }
  return (
    <Button size="sm" variant="outline" disabled={loading} onClick={open}>
      <FileText className="h-4 w-4" /> Receipt
    </Button>
  );
}
