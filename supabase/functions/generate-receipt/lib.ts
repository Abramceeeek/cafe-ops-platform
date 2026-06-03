// Pure receipt-model builder — PROJECT_SPEC §12.1. Testable; PDF rendering is in
// index.ts. unit_cost is optional (specialists may not have priced items).

export interface RItem {
  name: string;
  modifiers: string[];
  quantity: number;
  unit: string;
  unit_cost: number | null;
}

export interface ReceiptLine {
  desc: string;
  qty: string;
  amount: string;
}

export interface ReceiptModel {
  lines: ReceiptLine[];
  total: number;
  hasCosts: boolean;
}

export function buildReceiptModel(items: RItem[]): ReceiptModel {
  let total = 0;
  let hasCosts = false;
  const lines = items.map((i) => {
    const mods = i.modifiers.length ? ` (${i.modifiers.join(", ")})` : "";
    let amount = "-";
    if (i.unit_cost != null) {
      const lineTotal = i.unit_cost * i.quantity;
      total += lineTotal;
      hasCosts = true;
      amount = `GBP ${lineTotal.toFixed(2)}`;
    }
    return { desc: `${i.name}${mods}`, qty: `${i.quantity} ${i.unit}`, amount };
  });
  return { lines, total, hasCosts };
}
