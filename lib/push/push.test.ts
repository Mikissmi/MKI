import { describe, expect, it } from "vitest";
import { pushConfig, pushSink } from "./config";
import { eventReminderDue, inQuietHours, withinWindow } from "./rules";

describe("horário silencioso", () => {
  it("atravessa a meia-noite", () => {
    expect(inQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(3 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(7 * 60, "22:00", "07:00")).toBe(false);
    expect(inQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
    expect(inQuietHours(22 * 60, "22:00", "07:00")).toBe(true);
  });
  it("no mesmo dia e sem horário silencioso", () => {
    expect(inQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
    expect(inQuietHours(15 * 60, "12:00", "14:00")).toBe(false);
    expect(inQuietHours(600, "08:00", "08:00")).toBe(false);
    expect(inQuietHours(600, "xx", "08:00")).toBe(false);
  });
});

describe("janelas dos avisos", () => {
  it("aviso do horário marcado vale por 3 horas", () => {
    expect(withinWindow(7 * 60 + 29, 7 * 60 + 30)).toBe(false);
    expect(withinWindow(7 * 60 + 30, 7 * 60 + 30)).toBe(true);
    expect(withinWindow(10 * 60 + 29, 7 * 60 + 30)).toBe(true);
    expect(withinWindow(10 * 60 + 30, 7 * 60 + 30)).toBe(false);
  });
  it("lembrete de evento: de X minutos antes até o começo", () => {
    expect(eventReminderDue(9 * 60 + 44, 10 * 60, 15)).toBe(false);
    expect(eventReminderDue(9 * 60 + 45, 10 * 60, 15)).toBe(true);
    expect(eventReminderDue(9 * 60 + 59, 10 * 60, 15)).toBe(true);
    expect(eventReminderDue(10 * 60, 10 * 60, 15)).toBe(false);
  });
});

describe("configuração das notificações", () => {
  it("lista o que falta", () => {
    expect(pushConfig({}).missing).toEqual(["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
    const ok = pushConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "mailto:eu@exemplo.com", CRON_SECRET: "x".repeat(16) });
    expect(ok.configured).toBe(true); expect(ok.cronConfigured).toBe(true);
    expect(pushConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "eu@exemplo.com" }).missing).toEqual(["VAPID_SUBJECT"]);
    expect(pushConfig({ CRON_SECRET: "curto" }).cronConfigured).toBe(false);
  });
  it("o servidor falso só vale em teste local", () => {
    expect(pushSink({ MKI_PUSH_SINK: "http://127.0.0.1:1" })).toBeNull();
    expect(pushSink({ MKI_PUSH_SINK: "http://127.0.0.1:1", MKI_DEV_ALLOW_LOOPBACK: "1", DATABASE_URL: "postgres://x@db.neon.tech/x" })).toBeNull();
    expect(pushSink({ MKI_PUSH_SINK: "http://127.0.0.1:1", MKI_DEV_ALLOW_LOOPBACK: "1", DATABASE_URL: "postgres://x@localhost:5/x" })).toBe("http://127.0.0.1:1");
  });
});
