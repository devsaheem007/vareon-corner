import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, Trash2 } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Btn, Card, Confirm, Pager, Table, fmtDate, inputCls, useDebounced, useList, useToast } from "../ui";
import type { Subscriber } from "../types";

export default function SubscribersPanel() {
  const notify = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, loading, reload } = useList<Subscriber>("/admin/subscribers", { search: q, page, limit: 20 });
  const [del, setDel] = useState<Subscriber | null>(null);

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Private updates</p>
      <h1 className="font-display text-4xl font-bold">Subscribers</h1>
      <Card className="mt-8" action={<Btn variant="ghost" onClick={() => api.download("/admin/subscribers/export", "vareon-subscribers.csv").catch((e) => notify(errorMessage(e)))}><Download size={14} className="mr-2 inline" />Export CSV</Btn>}>
        <input className={`${inputCls} mb-4`} placeholder="Search email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Table head={["Email", "Source", "Joined", ""]} empty={!loading && data?.items.length === 0 ? "No subscribers yet." : undefined}>
          {data?.items.map((s) => (
            <tr key={s._id}>
              <td className="font-semibold">{s.email}</td>
              <td className="text-white/50">{s.source}</td>
              <td className="text-white/50">{fmtDate(s.createdAt)}</td>
              <td className="text-right"><Btn variant="ghost" aria-label="Remove subscriber" onClick={() => setDel(s)}><Trash2 size={14} /></Btn></td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </Card>
      <AnimatePresence>
        {del && <Confirm text={`Remove ${del.email} from the list?`} confirmLabel="Remove" onClose={() => setDel(null)} onConfirm={async () => { try { await api.delete(`/admin/subscribers/${del._id}`); notify("Subscriber removed"); } catch (e) { notify(errorMessage(e)); } void reload(); }} />}
      </AnimatePresence>
    </div>
  );
}
