"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// Live countdown to the next daily cut-off (Europe/London), matching the
// bobo & wild "FOH Home" mockup. Decorative dark banner; works in both themes.
export function CutoffCountdown({ cutoffHour = 10 }: { cutoffHour?: number }) {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      let rem = cutoffHour * 3600 - (get("hour") * 3600 + get("minute") * 60 + get("second"));
      if (rem <= 0) rem += 24 * 3600; // cut-off passed → counts to tomorrow's
      setSecs(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cutoffHour]);

  const hh = secs != null ? Math.floor(secs / 3600) : 0;
  const mm = secs != null ? Math.floor((secs % 3600) / 60) : 0;
  const pct = secs != null ? Math.min(100, Math.max(2, (secs / (24 * 3600)) * 100)) : 0;
  const closeLabel = `${((cutoffHour + 11) % 12) + 1}:00 ${cutoffHour < 12 ? "AM" : "PM"}`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 shadow-lg"
      style={{ background: "linear-gradient(150deg,#2A211A 0%,#3C2C1E 100%)", color: "#F6ECDC" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(circle at 90% 8%, rgba(226,112,58,.55), transparent 58%)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.13em]" style={{ color: "#E2A878" }}>
            Cut-off · tomorrow&apos;s orders
          </span>
          <Clock className="h-4 w-4" style={{ color: "#E2A878" }} />
        </div>
        <div className="mt-2 font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums">
          {secs == null ? "—" : hh}
          <span className="text-2xl font-medium opacity-60">h</span> {secs == null ? "" : String(mm).padStart(2, "0")}
          <span className="text-2xl font-medium opacity-60">m</span>
        </div>
        <div className="mt-3.5 h-[5px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.12)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--st-ready, #E2703A)" }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[12.5px]" style={{ color: "#CDB79E" }}>
          <span>Closes {closeLabel}</span>
          <span>Place orders before cut-off for next-day delivery</span>
        </div>
      </div>
    </div>
  );
}
