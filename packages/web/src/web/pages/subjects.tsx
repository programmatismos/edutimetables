import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, safeJson } from "../lib/api";
import { useState, useRef } from "react";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Plus, Trash2, Edit2, BookOpen, Upload } from "lucide-react";
import type { Subject, Class, Teacher } from "../types";

function emptyForm() {
  return { name: "", classId: 0, presenterId: 0, subjectType: "general", durationMinutes: 120, specialty: "", priority: 5, canSplit: false };
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: async () => safeJson(api.subjects.$get()) });
  const classes = useQuery({ queryKey: ["classes"], queryFn: async () => safeJson(api.classes.$get()) });
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: async () => safeJson(api.teachers.$get()) });

  const subjectList: Subject[] = (subjects.data as any)?.subjects || [];
  const classList: Class[] = (classes.data as any)?.classes || [];
  const teacherList: Teacher[] = (teachers.data as any)?.teachers || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [filterClass, setFilterClass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, classId: s.classId, presenterId: s.presenterId || 0, subjectType: s.subjectType, durationMinutes: s.durationMinutes, specialty: s.specialty || "", priority: s.priority, canSplit: s.canSplit ?? false });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const data = { ...form, classId: Number(form.classId), presenterId: Number(form.presenterId) || null, durationMinutes: Number(form.durationMinutes), priority: Number(form.priority) };
      if (editing) return safeJson((api.subjects as any)[":id"].$put({ param: { id: String(editing.id) }, json: data }));
      return safeJson(api.subjects.$post({ json: data }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); setOpen(false); },
    onError: (err: any) => alert(`Σφάλμα αποθήκευσης: ${err?.message || JSON.stringify(err)}`),
  });

  const del = useMutation({
    mutationFn: async (id: number) => safeJson((api.subjects as any)[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
    onError: (err: any) => alert(`Σφάλμα διαγραφής: ${err?.message || JSON.stringify(err)}`),
  });

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").slice(1);
      const list = lines.map((line) => {
        const [name, classLabel, presenterLastName, subjectType, durationMinutes, priority] = line.split(",").map(s => s.trim().replace(/"/g, ""));
        const cls = classList.find(c => c.label === classLabel);
        const teacher = teacherList.find(t => t.lastName === presenterLastName);
        if (!cls) return null;
        return {
          name,
          classId: cls.id,
          presenterId: teacher?.id || null,
          subjectType: subjectType || "general",
          durationMinutes: parseInt(durationMinutes) || 120,
          priority: parseInt(priority) || 5,
          specialty: teacher?.specialty || "",
        };
      }).filter(Boolean);
      if (list.length > 0) {
        await (api.subjects as any).import.$post({ json: { subjects: list } });
        qc.invalidateQueries({ queryKey: ["subjects"] });
      }
    };
    reader.readAsText(file, "UTF-8");
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = subjectList.filter((s) => !filterClass || s.classId === parseInt(filterClass));

  // Group by class
  const groupedByClass: Record<number, Subject[]> = {};
  for (const s of filtered) {
    if (!groupedByClass[s.classId]) groupedByClass[s.classId] = [];
    groupedByClass[s.classId].push(s);
  }

  const sortedClassIds = Object.keys(groupedByClass)
    .map(Number)
    .sort((a, b) => {
      const ca = classList.find(c => c.id === a);
      const cb = classList.find(c => c.id === b);
      return (cb?.gradeOrder || 0) - (ca?.gradeOrder || 0);
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Μαθήματα</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{subjectList.length} μαθήματα</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Import CSV
          </Button>
          <Button size="sm" onClick={openAdd}><Plus size={13} /> Νέο Μάθημα</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: 220 }}>
          <option value="">Όλες οι τάξεις</option>
          {classList.map(c => <option key={c.id} value={String(c.id)}>{c.label}</option>)}
        </Select>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>CSV: Μάθημα, Τάξη, Επώνυμο Εισηγητή, Τύπος (general/specialty), Διάρκεια, Προτεραιότητα</span>
      </div>

      {subjects.isLoading ? (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</div>
      ) : subjects.isError ? (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--danger)" }}>
          Σφάλμα φόρτωσης: {(subjects.error as any)?.message}
        </div>
      ) : subjectList.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <BookOpen size={36} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Δεν υπάρχουν μαθήματα. Πρόσθεσε ή κάνε import.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedClassIds.map((classId) => {
            const cls = classList.find(c => c.id === classId);
            const items = groupedByClass[classId];
            return (
              <div key={classId} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#F8FAFF", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{cls?.label || "Άγνωστη τάξη"}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{items.length} μαθήματα</span>
                </div>
                <table className="w-full text-sm" style={{ background: "var(--surface)" }}>
                  <thead style={{ background: "#FAFBFF" }}>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Μάθημα</th>
                      <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Εισηγητής</th>
                      <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Τύπος</th>
                      <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Διάρκεια</th>
                      <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Ενέργειες</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{s.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {s.presenter ? `${s.presenter.lastName} ${s.presenter.firstName}` : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={s.subjectType === "general" ? "green" : "purple"}>
                              {s.subjectType === "general" ? "Γεν. Παιδεία" : "Ειδικότητα"}
                            </Badge>
                            {s.canSplit && <Badge variant="yellow">Split</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {s.durationMinutes === 180 ? "3ωρο" : "2ωρο"} ({s.durationMinutes}΄)
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-gray-100">
                              <Edit2 size={13} style={{ color: "var(--text-secondary)" }} />
                            </button>
                            <button onClick={() => del.mutate(s.id)} className="p-1.5 rounded hover:bg-red-50">
                              <Trash2 size={13} style={{ color: "var(--danger)" }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <Modal title={editing ? "Επεξεργασία Μαθήματος" : "Νέο Μάθημα"} open={open} onClose={() => setOpen(false)} size="lg">
        <div className="space-y-4">
          <Input label="Όνομα Μαθήματος" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="π.χ. Νεοελληνική Γλώσσα" />
          <Select label="Τάξη" value={String(form.classId)} onChange={(e) => setForm({ ...form, classId: parseInt(e.target.value) })}>
            <option value="0">Επιλογή τάξης...</option>
            {classList.map(c => <option key={c.id} value={String(c.id)}>{c.label}</option>)}
          </Select>
          <Select label="Εισηγητής" value={String(form.presenterId)} onChange={(e) => setForm({ ...form, presenterId: parseInt(e.target.value), specialty: teacherList.find(t => t.id === parseInt(e.target.value))?.specialty || "" })}>
            <option value="0">Χωρίς εισηγητή</option>
            {teacherList.filter(t => t.role !== "supervisor").map(t => <option key={t.id} value={String(t.id)}>{t.lastName} {t.firstName} ({t.specialty})</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Τύπος Μαθήματος" value={form.subjectType} onChange={(e) => setForm({ ...form, subjectType: e.target.value })}>
              <option value="general">Γενικής Παιδείας</option>
              <option value="specialty">Ειδικότητας</option>
            </Select>
            <Select label="Διάρκεια" value={String(form.durationMinutes)} onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}>
              <option value="120">2ωρο (120΄)</option>
              <option value="180">3ωρο (180΄)</option>
            </Select>
          </div>
          <Select label="Προτεραιότητα Προγραμματισμού" value={String(form.priority)} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}>
            <option value="1">1 – Πολύ υψηλή (Γεν. Παιδεία πρώτο)</option>
            <option value="3">3 – Υψηλή</option>
            <option value="5">5 – Κανονική</option>
            <option value="7">7 – Χαμηλή</option>
            <option value="10">10 – Χαμηλότατη</option>
          </Select>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "var(--surface-2, #f8faff)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Split τμήματος</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Αν το τμήμα χρειάζεται split, αυτό το μάθημα μπορεί να εξεταστεί από 2 επιτηρητές παράλληλα</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, canSplit: !f.canSplit }))}
              className={`ml-4 flex-shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.canSplit ? "bg-blue-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${form.canSplit ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Ακύρωση</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name || !form.classId}>Αποθήκευση</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
