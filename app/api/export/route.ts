import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { exportAll, exportCsv, isExportTable } from "@/lib/export";
import { localDateKey } from "@/lib/time";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const url = new URL(req.url);
  const day = localDateKey();
  if (url.searchParams.get("format") === "csv") {
    const table = url.searchParams.get("table") ?? "";
    if (!isExportTable(table)) return NextResponse.json({ error: "tabela inválida" }, { status: 400 });
    return new NextResponse(await exportCsv(user.id, table), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="mki-${table}-${day}.csv"`, "cache-control": "no-store" } });
  }
  return new NextResponse(JSON.stringify(await exportAll(user.id), null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="mki-backup-${day}.json"`, "cache-control": "no-store" } });
}
