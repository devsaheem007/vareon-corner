import { useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { Badge, Card, Pager, Table, fmtDate, inputCls, useDebounced, useList, useToast } from "../ui";
import type { AdminUser } from "../types";

export default function UsersPanel({ me }: { me: AdminUser }) {
  const notify = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, loading, reload } = useList<AdminUser>("/admin/users", { search: q, page, limit: 20 });

  const patch = async (u: AdminUser, body: Partial<Pick<AdminUser, "role" | "isActive">>) => {
    try {
      await api.patch(`/admin/users/${u._id}`, body);
      notify("Account updated");
    } catch (e) {
      notify(errorMessage(e));
    }
    void reload();
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">Access</p>
      <h1 className="font-display text-4xl font-bold">Accounts</h1>
      <Card className="mt-8">
        <input className={`${inputCls} mb-4`} placeholder="Search name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Table head={["Account", "Role", "Status", "Joined", "Last sign-in"]} empty={!loading && data?.items.length === 0 ? "No accounts found." : undefined}>
          {data?.items.map((u) => {
            const self = u._id === me._id;
            return (
              <tr key={u._id}>
                <td><b>{u.name}{self && <span className="ml-2 text-[10px] text-white/40">(you)</span>}</b><p className="text-xs text-white/40">{u.email}</p></td>
                <td>
                  {self ? <Badge>{u.role}</Badge> : (
                    <select aria-label="Role" className="rounded-lg border border-white/10 bg-[#181818] px-2 py-1.5 text-xs" value={u.role} onChange={(e) => patch(u, { role: e.target.value as AdminUser["role"] })}>
                      <option>customer</option><option>admin</option>
                    </select>
                  )}
                </td>
                <td>
                  {self ? <Badge>live</Badge> : (
                    <button onClick={() => patch(u, { isActive: !u.isActive })} aria-label={u.isActive ? "Deactivate account" : "Activate account"}>
                      <Badge>{u.isActive ? "live" : "hidden"}</Badge>
                    </button>
                  )}
                </td>
                <td className="text-white/50">{fmtDate(u.createdAt)}</td>
                <td className="text-white/50">{fmtDate(u.lastLoginAt)}</td>
              </tr>
            );
          })}
        </Table>
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
