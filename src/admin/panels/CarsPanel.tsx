import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import {
  Badge,
  Btn,
  Card,
  Confirm,
  Field,
  Modal,
  Table,
  fmtMoney,
  inputCls,
  useToast,
} from "../ui";
import type { CarRecord } from "../types";

const CATEGORIES = ["Supercars", "SUVs", "Electric", "Luxury Sedans"];
const FUELS = ["EV", "Hybrid", "Petrol"];

type Form = Omit<CarRecord, "id"> & { id?: number };
const blank = (): Form => ({
  name: "",
  category: "Supercars",
  fuel: "Petrol",
  price: 0,
  hp: 0,
  zero: 0,
  top: 0,
  transmission: "",
  image: "",
  isActive: true,
  colors: [{ name: "Signature", accent: "#E63946", image: "" }],
});

function ImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const notify = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", f);
      const r = await api.post<{ url: string }>("/admin/uploads", fd);
      onChange(r.url);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <div className="flex gap-2">
      <input
        className={inputCls}
        placeholder="/cars/photo.jpg or https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <Btn
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => file.current?.click()}
        aria-label="Upload image"
      >
        <Upload size={14} />
      </Btn>
    </div>
  );
}

function CarForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Form;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useToast();
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const num = (k: "price" | "hp" | "zero" | "top") => (
    <input
      className={inputCls}
      type="number"
      min={0}
      step={k === "zero" ? "0.1" : "1"}
      value={f[k]}
      onChange={(e) => set(k, Number(e.target.value))}
    />
  );
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        name: f.name,
        category: f.category,
        fuel: f.fuel,
        price: f.price,
        hp: f.hp,
        zero: f.zero,
        top: f.top,
        transmission: f.transmission,
        image: f.image,
        isActive: f.isActive,
        // a finish without its own photo falls back to the main image
        colors: f.colors.map((c) => ({ ...c, image: c.image || f.image })),
      };
      if (f.id) await api.patch(`/admin/cars/${f.id}`, body);
      else await api.post("/admin/cars", body);
      notify(f.id ? "Vehicle updated" : "Vehicle added");
      onSaved();
      onClose();
    } catch (e) {
      notify(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      wide
      eyebrow={f.id ? `Vehicle #${f.id}` : "New listing"}
      title={f.id ? "Edit vehicle" : "Add vehicle"}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name">
            <input
              className={inputCls}
              maxLength={80}
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            className={inputCls}
            value={f.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Fuel">
          <select
            className={inputCls}
            value={f.fuel}
            onChange={(e) => set("fuel", e.target.value)}
          >
            {FUELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Price (USD)">{num("price")}</Field>
        <Field label="Transmission">
          <input
            className={inputCls}
            value={f.transmission}
            onChange={(e) => set("transmission", e.target.value)}
          />
        </Field>
        <Field label="Horsepower">{num("hp")}</Field>
        <Field label="0-60 mph (s)">{num("zero")}</Field>
        <Field label="Top speed (mph)">{num("top")}</Field>
        <Field label="Visibility">
          <select
            className={inputCls}
            value={f.isActive ? "1" : "0"}
            onChange={(e) => set("isActive", e.target.value === "1")}
          >
            <option value="1">Live on website</option>
            <option value="0">Hidden</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Main image"
            hint="Upload a JPG, PNG, WebP or AVIF (max 4 MB) or paste a path / https URL."
          >
            <ImageInput value={f.image} onChange={(v) => set("image", v)} />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/40">
          Finishes (colours)
        </p>
        <div className="grid gap-3">
          {f.colors.map((c, i) => (
            <div
              key={i}
              className="grid items-center gap-2 rounded-2xl bg-white/[.03] p-3 sm:grid-cols-[1fr_auto_1.4fr_auto]"
            >
              <input
                className={inputCls}
                placeholder="Finish name"
                value={c.name}
                onChange={(e) =>
                  set(
                    "colors",
                    f.colors.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                type="color"
                aria-label="Accent colour"
                className="h-11 w-14 cursor-pointer rounded-xl border border-white/10 bg-black/20 p-1"
                value={c.accent}
                onChange={(e) =>
                  set(
                    "colors",
                    f.colors.map((x, j) =>
                      j === i ? { ...x, accent: e.target.value } : x,
                    ),
                  )
                }
              />
              <ImageInput
                value={c.image}
                onChange={(v) =>
                  set(
                    "colors",
                    f.colors.map((x, j) => (j === i ? { ...x, image: v } : x)),
                  )
                }
              />
              <Btn
                type="button"
                variant="ghost"
                disabled={f.colors.length <= 1}
                onClick={() =>
                  set(
                    "colors",
                    f.colors.filter((_, j) => j !== i),
                  )
                }
                aria-label="Remove finish"
              >
                <Trash2 size={14} />
              </Btn>
            </div>
          ))}
        </div>
        <Btn
          type="button"
          variant="ghost"
          className="mt-3"
          disabled={f.colors.length >= 8}
          onClick={() =>
            set("colors", [
              ...f.colors,
              { name: "", accent: "#888888", image: "" },
            ])
          }
        >
          + Add finish
        </Btn>
        <p className="mt-2 text-[11px] text-white/30">
          Leave a finish photo empty to reuse the main image.
        </p>
      </div>

      <div className="mt-8 flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          className="flex-1"
          disabled={busy || !f.name || !f.image || !f.transmission}
          onClick={save}
        >
          {busy ? "Saving…" : "Save vehicle"}
        </Btn>
      </div>
    </Modal>
  );
}

export default function CarsPanel() {
  const notify = useToast();
  const [cars, setCars] = useState<CarRecord[] | null>(null);
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<CarRecord | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setCars((await api.get<{ cars: CarRecord[] }>("/admin/cars")).cars);
    } catch (e) {
      notify(errorMessage(e));
    }
  }, [notify]);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (c: CarRecord) => {
    try {
      await api.patch(`/admin/cars/${c.id}`, { isActive: !c.isActive });
    } catch (e) {
      notify(errorMessage(e));
    }
    void load();
  };
  const shown = (cars ?? []).filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-crimson">
        Inventory
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-bold">Vehicles</h1>
        <Btn onClick={() => setEdit(blank())}>
          <Plus size={14} className="mr-1 inline" /> Add vehicle
        </Btn>
      </div>
      <Card className="mt-8">
        <input
          className={`${inputCls} mb-4`}
          placeholder="Search vehicles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Table
          head={["", "Vehicle", "Category", "Price", "Power", "Status", ""]}
          empty={cars && shown.length === 0 ? "No vehicles found." : undefined}
        >
          {shown.map((c) => (
            <tr key={c.id}>
              <td className="w-20">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="h-12 w-20 rounded-lg bg-white/5 object-cover"
                />
              </td>
              <td>
                <b>{c.name}</b>
                <p className="text-xs text-white/40">
                  #{c.id} · {c.fuel} · {c.transmission}
                </p>
              </td>
              <td className="text-white/60">{c.category}</td>
              <td className="whitespace-nowrap">{fmtMoney(c.price)}</td>
              <td className="whitespace-nowrap text-white/60">
                {c.hp} HP · {c.zero}s
              </td>
              <td>
                <button
                  onClick={() => toggle(c)}
                  aria-label={c.isActive ? "Hide vehicle" : "Show vehicle"}
                >
                  <Badge>{c.isActive ? "live" : "hidden"}</Badge>
                </button>
              </td>
              <td className="whitespace-nowrap text-right">
                <Btn
                  variant="ghost"
                  aria-label="Edit vehicle"
                  className="mr-2"
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={14} />
                </Btn>
                <Btn
                  variant="ghost"
                  aria-label="Delete vehicle"
                  onClick={() => setDel(c)}
                >
                  <Trash2 size={14} />
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <AnimatePresence>
        {edit && (
          <CarForm
            initial={edit}
            onClose={() => setEdit(null)}
            onSaved={load}
          />
        )}
        {del && (
          <Confirm
            text={`Permanently delete ${del.name}? Hide it instead if you may want it back.`}
            onClose={() => setDel(null)}
            onConfirm={async () => {
              try {
                await api.delete(`/admin/cars/${del.id}`);
                notify("Vehicle deleted");
              } catch (e) {
                notify(errorMessage(e));
              }
              void load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
