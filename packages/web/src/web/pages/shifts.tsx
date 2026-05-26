import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Plus, Trash2, Edit2, Clock } from "lucide-react";
import type { Shift } from "../types";

export default function ShiftsPage() {
  const qc = useQueryClient();
  const shifts = useQuery({ queryKey: ["shifts"], queryFn: async () => (await api.shifts.$get()).json() });
  const shiftList: Shift[] = (shifts.data as any)?.shifts || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState({ name: "", startTime: "", endTime: "", durationMinutes: 120, order: 1 });

  const openAdd = () => { setEditing(null); setForm({ name: "", startTime: "", endTime: "", durationMinutes: 120, order: shiftList.length + 1 }); setOpen(true); };
  const openEdit = (s: Shift) => { setEditing(s); setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, durationMinutes: s.durationMinutes, order: s.order }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return (await (api.shifts as any)[":id"].$put({ param: { id: String(editing.id) }, json: form })).json();
      }
      return (await api.shifts.$post({ json: form })).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await (api.shifts as any)[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => (await (api.shifts as any)["seed-defaults"].$post()).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Βάρδιες</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Ορισμός ωραρίου εξετάσεων ανά βάρδια</p>
        </div>
        <div className="flex gap-2">
          {shiftList.length === 0 && (
            <Button variant="secondary" size="sm" onClick={() => seedDefaults.mutate()} loading={seedDefaults.isPending}>
              Προεπιλογές
            </Button>
          )}
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} /> Νέα Βάρδια
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {shifts.isLoading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</div>
        ) : shiftList.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Clock size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Δεν υπάρχουν βάρδιες. Πάτα "Προεπιλογές" για να φορτώσεις τις default βάρδιες.</p>
          </div>
        ) : (
          shiftList.map((s) => (
            <div key={s.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                  {s.order}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {s.startTime} – {s.endTime} · {s.durationMinutes} λεπτά
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <Edit2 size={14} style={{ color: "var(--text-secondary)" }} />
                </button>
                <button onClick={() => del.mutate(s.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} style={{ color: "var(--danger)" }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal title={editing ? "Επεξεργασία Βάρδιας" : "Νέα Βάρδια"} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input label="Όνομα" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="π.χ. Α Βάρδια" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ώρα Έναρξης" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="Ώρα Λήξης" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Διάρκεια (λεπτά)" type="number" value={String(form.durationMinutes)} onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 120 })} />
            <Input label="Σειρά" type="number" value={String(form.order)} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Ακύρωση</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>Αποθήκευση</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
