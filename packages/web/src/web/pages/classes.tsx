import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, safeJson } from "../lib/api";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Plus, Trash2, Edit2, GraduationCap, Split } from "lucide-react";
import type { Class } from "../types";

const SPLIT_THRESHOLD = 25; // default κατώφλι μαθητών για αυτόματο split

function emptyForm() {
  return { grade: "Α", department: "", label: "", schoolType: "ΓΕΛ", gradeOrder: 1, studentCount: 0, forceSplit: false };
}

const gradeOrders: Record<string, number> = { "Α": 1, "Β": 2, "Γ": 3 };

export default function ClassesPage() {
  const qc = useQueryClient();
  const classes = useQuery({ queryKey: ["classes"], queryFn: async () => (await api.classes.$get()).json() });
  const classList: Class[] = (classes.data as any)?.classes || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [form, setForm] = useState(emptyForm());

  const buildLabel = (grade: string, dept: string, type: string) => {
    if (dept) return `${grade} ${dept}`;
    return `${grade} ${type}`;
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c: Class) => {
    setEditing(c);
    setForm({ grade: c.grade, department: c.department || "", label: c.label, schoolType: c.schoolType, gradeOrder: c.gradeOrder, studentCount: c.studentCount ?? 0, forceSplit: c.forceSplit ?? false });
    setOpen(true);
  };

  const needsSplit = (c: Class) => c.forceSplit || (c.studentCount > SPLIT_THRESHOLD);

  const save = useMutation({
    mutationFn: async () => {
      const label = buildLabel(form.grade, form.department, form.schoolType);
      const data = { ...form, label, gradeOrder: gradeOrders[form.grade] || 1 };
      if (editing) return safeJson((api.classes as any)[":id"].$put({ param: { id: String(editing.id) }, json: data }));
      return safeJson(api.classes.$post({ json: data }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); setOpen(false); },
    onError: (err: any) => alert(`Σφάλμα αποθήκευσης: ${err?.message || JSON.stringify(err)}`),
  });

  const del = useMutation({
    mutationFn: async (id: number) => safeJson((api.classes as any)[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
    onError: (err: any) => alert(`Σφάλμα διαγραφής: ${err?.message || JSON.stringify(err)}`),
  });

  const gradeVariants: Record<string, "blue" | "yellow" | "red"> = { "Α": "blue", "Β": "yellow", "Γ": "red" };

  const groupedByGrade = ["Γ", "Β", "Α"].map(g => ({
    grade: g,
    items: classList.filter(c => c.grade === g),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Τάξεις & Τμήματα</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{classList.length} τμήματα</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={13} /> Νέα Τάξη</Button>
      </div>

      {classes.isLoading ? (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</div>
      ) : classList.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <GraduationCap size={36} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Δεν υπάρχουν τάξεις. Πρόσθεσε την πρώτη τάξη.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByGrade.map(({ grade, items }) => (
            <div key={grade} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#F8FAFF", borderBottom: "1px solid var(--border)" }}>
                <Badge variant={gradeVariants[grade] || "gray"}>{grade}΄ Τάξη</Badge>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{items.length} τμήματα</span>
              </div>
              <div className="divide-y" style={{ background: "var(--surface)" }}>
                {items.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.label}</span>
                      <Badge variant={c.schoolType === "ΓΕΛ" ? "blue" : c.schoolType === "ΓΥΜΝΑΣΙΟ" ? "green" : c.schoolType === "ΣΑΕΚ" ? "yellow" : "purple"}>{c.schoolType}</Badge>
                      {c.department && <Badge variant="gray">{c.department}</Badge>}
                      {c.studentCount > 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.studentCount} μαθητές</span>}
                      {needsSplit(c) && <Badge variant="yellow"><Split size={10} className="inline mr-1" />Split</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100">
                        <Edit2 size={13} style={{ color: "var(--text-secondary)" }} />
                      </button>
                      <button onClick={() => del.mutate(c.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={13} style={{ color: "var(--danger)" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal title={editing ? "Επεξεργασία Τάξης" : "Νέα Τάξη"} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Τάξη" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, gradeOrder: gradeOrders[e.target.value] || 1 })}>
              <option value="Α">Α΄ Τάξη</option>
              <option value="Β">Β΄ Τάξη</option>
              <option value="Γ">Γ΄ Τάξη</option>
              {(form.schoolType === "ΓΥΜΝΑΣΙΟ") && <option value="Δ">Δ΄ Τάξη</option>}
              {(form.schoolType === "ΣΑΕΚ") && <option value="Α1">Α1 (Εξάμηνο)</option>}
              {(form.schoolType === "ΣΑΕΚ") && <option value="Α2">Α2 (Εξάμηνο)</option>}
              {(form.schoolType === "ΣΑΕΚ") && <option value="Β1">Β1 (Εξάμηνο)</option>}
              {(form.schoolType === "ΣΑΕΚ") && <option value="Β2">Β2 (Εξάμηνο)</option>}
            </Select>
            <Select label="Τύπος Σχολείου" value={form.schoolType} onChange={(e) => setForm({ ...form, schoolType: e.target.value })}>
              <option value="ΓΕΛ">ΓΕΛ</option>
              <option value="ΕΠΑΛ">ΕΠΑΛ</option>
              <option value="ΓΥΜΝΑΣΙΟ">Γυμνάσιο</option>
              <option value="ΣΑΕΚ">Μεταλυκειακό (ΣΑΕΚ)</option>
            </Select>
          </div>
          <Input
            label="Τμήμα / Ειδικότητα (αν υπάρχει)"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="π.χ. Οικονομίας, Πληροφορικής (άδειο για ΓΕΛ)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Αριθμός μαθητών"
              type="number"
              min={0}
              value={form.studentCount}
              onChange={(e) => setForm({ ...form, studentCount: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Split τμήματος</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, forceSplit: !f.forceSplit }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.forceSplit ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${form.forceSplit ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {form.forceSplit ? "Πάντα split" : form.studentCount > SPLIT_THRESHOLD ? `Αυτόματο (>${SPLIT_THRESHOLD})` : "Όχι split"}
                </span>
              </div>
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            Αναγνωριστικό: <strong>{buildLabel(form.grade, form.department, form.schoolType)}</strong>
            {(form.forceSplit || form.studentCount > SPLIT_THRESHOLD) && <span className="ml-2 font-normal">· Θα χρειαστεί 2 επιτηρητές για split μαθήματα</span>}
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
