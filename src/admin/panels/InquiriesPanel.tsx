import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Badge, Btn, Card, Confirm, Pager, Table, fmtDate, fmtMoney, inputCls, useDebounced, useList, useToast } from "../ui";
import type { Inquiry, InquiryStatus } from "../types";

const STATUSES: InquiryStatus[] = ["new", "contacted", "closed"];

export default function InquiriesPanel() {
  const notify = useToast();
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, loading, reload } = useList<Inquiry>("/admin/inquiries", { status, type, search: q, page, limit: 15 });
  const [del, setDel] = useState<Inquiry | null>(null);

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Leads</p>
      <h1 className="font-display text-4xl font-bold">Inquiries</h1>
      <Card className="mt-8">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_160px_160px]">
          <input className={inputCls} placeholder="Search name, email or vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All types</option><option>finance</option><option>general</option>
          </select>
          <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <Table head={["Received", "Contact", "Request", "Status", ""]} empty={!loading && data?.items.length === 0 ? "No inquiries match." : undefined}>
          {data?.items.map((i) => (
            <tr key={i._id}>
              <td className="whitespace-nowrap text-white/60">{fmtDate(i.createdAt)}<p className="mt-1"><Badge>{i.type}</Badge></p></td>
              <td><b>{i.name}</b><p className="text-xs text-white/40">{i.email}</p><p className="text-xs text-white/40">{i.phone}</p></td>
              <td className="max-w-xs">
                {i.carName && <p className="font-semibold">{i.carName}</p>}
                {i.finance && <p className="text-xs text-white/60">{fmtMoney(i.finance.monthly)}/mo · {fmtMoney(i.finance.down)} down · {i.finance.rate}% · {i.finance.years}y (on {fmtMoney(i.finance.price)})</p>}
                {i.message && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-white/50">{i.message}</p>}
              </td>
              <td>
                <select aria-label="Status" className="rounded-lg border border-white/10 bg-[#181818] px-2 py-1.5 text-xs" value={i.status} onChange={async (e) => { try { await api.patch(`/admin/inquiries/${i._id}`, { status: e.target.value }); } catch (err) { notify(errorMessage(err)); } void reload(); }}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="text-right"><Btn variant="ghost" aria-label="Delete inquiry" onClick={() => setDel(i)}><Trash2 size={14} /></Btn></td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </Card>
      <AnimatePresence>
        {del && <Confirm text={`Delete the inquiry from ${del.name}?`} onClose={() => setDel(null)} onConfirm={async () => { try { await api.delete(`/admin/inquiries/${del._id}`); notify("Inquiry deleted"); } catch (e) { notify(errorMessage(e)); } void reload(); }} />}
      </AnimatePresence>
    </div>
  );
}
