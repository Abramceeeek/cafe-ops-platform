"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function CountdownBanner({ serverNowStr }: { serverNowStr: string }) {
  const [cd, setCd] = useState(() => calculateCutoff(new Date(serverNowStr)));
  
  useEffect(() => {
    // Determine the offset between local browser time and server time
    const localNow = new Date().getTime();
    const serverNow = new Date(serverNowStr).getTime();
    const offset = serverNow - localNow;

    const interval = setInterval(() => {
      const now = new Date(new Date().getTime() + offset);
      setCd(calculateCutoff(now));
    }, 60000); // update every minute

    return () => clearInterval(interval);
  }, [serverNowStr]);

  return (
    <div className="countdown">
      <div className="flex items-center justify-between">
        <span className="cd-eyebrow">Cut-off · tomorrow&rsquo;s orders</span>
        <Clock className="h-4 w-4" style={{ color: "#e2a878" }} />
      </div>
      {cd.open ? (
        <div className="cd-time">
          {cd.h}
          <span>h</span> {cd.m}
          <span>m</span>
        </div>
      ) : (
        <div className="cd-time" style={{ fontSize: 30 }}>
          Closed
        </div>
      )}
      <div className="cd-track">
        <div className="cd-fill" style={{ width: `${cd.fill}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px]" style={{ color: "#cdb79e" }}>
        <span>Closes 4:00 PM</span>
        <span>
          Next window ·{" "}
          <strong style={{ color: "#ead9c2", fontWeight: 700 }}>{cd.nextLabel}</strong>
        </span>
      </div>
    </div>
  );
}

function calculateCutoff(now: Date) {
  const london = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const cutoff = new Date(london);
  cutoff.setHours(16, 0, 0, 0);
  const remainingMin = Math.floor((cutoff.getTime() - london.getTime()) / 60000);
  const open = remainingMin > 0;
  const next = new Date(london);
  next.setDate(next.getDate() + (open ? 1 : 2));
  return {
    open,
    h: Math.max(0, Math.floor(remainingMin / 60)),
    m: Math.max(0, remainingMin % 60),
    fill: open ? Math.min(100, Math.max(4, ((960 - remainingMin) / 960) * 100)) : 100,
    nextLabel: next.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
  };
}
