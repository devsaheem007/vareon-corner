import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Btn, Card, Confirm, Pager, Table, inputCls, useDebounced, useList, useToast } from "../ui";
import type { Booking, BookingStatus } from "../types";

const STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export default function BookingsPanel() {
  const notify = useToast();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, loading, reload } = useList<Booking>("/admin/bookings", { status, search: q, page, limit: 15 });
  const [del, setDel] = useState<Booking | null>(null);

  const setBookingStatus = async (b: Booking, next: BookingStatus) => {
    try {
      await api.patch(`/admin/bookings/${b._id}`, { status: next });
      notify(`Marked ${next}`);
    } catch (e) {
      notify(errorMessage(e));
    }
    void reload();
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Appointments</p>
      <h1 className="font-display text-4xl font-bold">Test drives</h1>
      <Card className="mt-8">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <input className={inputCls} placeholder="Search name, email or vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <Table head={["When", "Guest", "Vehicle", "Showroom", "Status", ""]} empty={!loading && data?.items.length === 0 ? "No test drives match." : undefined}>
          {data?.items.map((b) => (
            <tr key={b._id}>
              <td className="whitespace-nowrap"><b>{b.date}</b><p className="text-xs text-white/40">{b.time}</p></td>
              <td><b>{b.name}</b><p className="text-xs text-white/40">{b.email}</p><p className="text-xs text-white/40">{b.phone}</p></td>
              <td>{b.carName}</td>
              <td className="text-white/60">{b.location}</td>
              <td>
                <select aria-label="Status" className="rounded-lg border border-white/10 bg-[#181818] px-2 py-1.5 text-xs" value={b.status} onChange={(e) => setBookingStatus(b, e.target.value as BookingStatus)}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="text-right"><Btn variant="ghost" aria-label="Delete booking" onClick={() => setDel(b)}><Trash2 size={14} /></Btn></td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </Card>
      <AnimatePresence>
        {del && <Confirm text={`Delete the ${del.date} test drive for ${del.name}? This cannot be undone.`} onClose={() => setDel(null)} onConfirm={async () => { try { await api.delete(`/admin/bookings/${del._id}`); notify("Booking deleted"); } catch (e) { notify(errorMessage(e)); } void reload(); }} />}
      </AnimatePresence>
    </div>
  );
}
