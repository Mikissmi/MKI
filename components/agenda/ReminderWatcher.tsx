"use client";

import { useEffect, useRef } from "react";
import { notifications } from "@mantine/notifications";

type Reminder = { key: string; title: string; startsAt: number; remindAt: number; location: string | null };
const STORE = "mki:reminders-shown";

function shown(): string[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "[]"); } catch { return []; }
}

/** Avisos dentro do app (sem push): mostra o lembrete quando chega a hora, com o app aberto. */
export function ReminderWatcher() {
  const list = useRef<Reminder[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/agenda/reminders", { cache: "no-store" });
        if (res.ok && alive) list.current = (await res.json()).reminders;
      } catch { /* offline: tenta de novo depois */ }
    };
    const tick = () => {
      const now = Date.now();
      const done = shown();
      for (const r of list.current) {
        // avisa de remindAt até 10 min depois do início; nunca repete
        if (now >= r.remindAt && now <= r.startsAt + 10 * 60_000 && !done.includes(r.key)) {
          const mins = Math.round((r.startsAt - now) / 60_000);
          notifications.show({
            title: r.title, color: "lotus", autoClose: false, withCloseButton: true,
            message: `${mins > 0 ? `começa em ${mins} min` : "começa agora"}${r.location ? ` · ${r.location}` : ""}`,
          });
          done.push(r.key);
          localStorage.setItem(STORE, JSON.stringify(done.slice(-100)));
        }
      }
    };
    load().then(tick);
    const refresh = setInterval(load, 5 * 60_000);
    const check = setInterval(tick, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") load().then(tick); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(refresh); clearInterval(check); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  return null;
}
