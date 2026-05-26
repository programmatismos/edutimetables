import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState, useRef } from "react";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Plus, Trash2, Edit2, Users, Upload, CalendarOff, X } from "lucide-react";
import type { Teacher, TeacherUnavailable, Shift } from "../types";

const SPECIALTIES = [
  // ΠΕ — Πανεπιστημιακής Εκπαίδευσης
  { code: "ΠΕ01", label: "Θεολόγοι" },
  { code: "ΠΕ02", label: "Φιλόλογοι" },
  { code: "ΠΕ03", label: "Μαθηματικοί" },
  { code: "ΠΕ04.01", label: "Φυσικοί" },
  { code: "ΠΕ04.02", label: "Χημικοί" },
  { code: "ΠΕ04.03", label: "Φυσιογνώστες" },
  { code: "ΠΕ04.04", label: "Βιολόγοι" },
  { code: "ΠΕ04.05", label: "Γεωλόγοι" },
  { code: "ΠΕ05", label: "Γαλλικής" },
  { code: "ΠΕ06", label: "Αγγλικής" },
  { code: "ΠΕ07", label: "Γερμανικής" },
  { code: "ΠΕ08", label: "Καλλιτεχνικών" },
  { code: "ΠΕ11", label: "Φυσικής Αγωγής" },
  { code: "ΠΕ33", label: "Μεθοδολογίας Ιστορίας και Θεωρίας της Επιστήμης (ΜΙΘΕ)" },
  { code: "ΠΕ34", label: "Ιταλικής Φιλολογίας" },
  { code: "ΠΕ40", label: "Ισπανικής" },
  { code: "ΠΕ60", label: "Νηπιαγωγοί" },
  { code: "ΠΕ70", label: "Δάσκαλοι" },
  { code: "ΠΕ78", label: "Κοινωνικών Επιστημών" },
  { code: "ΠΕ79.01", label: "Μουσικής Επιστήμης" },
  { code: "ΠΕ79.02", label: "Τεχνολόγοι Μουσικής Τεχνολογίας Ήχου και Μουσικών Οργάνων" },
  { code: "ΠΕ80", label: "Οικονομίας" },
  { code: "ΠΕ81", label: "Πολ.Μηχανικών - Αρχιτεκτόνων" },
  { code: "ΠΕ82", label: "Μηχανολόγων" },
  { code: "ΠΕ83", label: "Ηλεκτρολόγων" },
  { code: "ΠΕ84", label: "Ηλεκτρονικών" },
  { code: "ΠΕ85", label: "Χημικών Μηχανικών" },
  { code: "ΠΕ86", label: "Πληροφορικής" },
  { code: "ΠΕ87.01", label: "Ιατρικής" },
  { code: "ΠΕ87.02", label: "Νοσηλευτικής" },
  { code: "ΠΕ87.03", label: "Αισθητικής" },
  { code: "ΠΕ87.04", label: "Ιατρικών Εργαστηρίων" },
  { code: "ΠΕ87.05", label: "Οδοντοτεχνικής" },
  { code: "ΠΕ87.06", label: "Κοινωνικής Εργασίας" },
  { code: "ΠΕ87.07", label: "Ραδιολογίας-Ακτινολογίας" },
  { code: "ΠΕ87.08", label: "Φυσιοθεραπείας" },
  { code: "ΠΕ87.09", label: "Βρεφονηπιοκόμων" },
  { code: "ΠΕ87.10", label: "Δημόσιας Υγιεινής" },
  { code: "ΠΕ88.01", label: "Γεωπόνοι" },
  { code: "ΠΕ88.02", label: "Φυτικής Παραγωγής" },
  { code: "ΠΕ88.03", label: "Ζωικής Παραγωγής" },
  { code: "ΠΕ88.04", label: "Διατροφής" },
  { code: "ΠΕ88.05", label: "Φυσικού Περιβάλλοντος" },
  { code: "ΠΕ89.01", label: "Καλλιτεχνικών Σπουδών" },
  { code: "ΠΕ89.02", label: "Σχεδιασμού και Παραγωγής Προϊόντων" },
  { code: "ΠΕ90", label: "Ναυτικών Μαθημάτων" },
  { code: "ΠΕ91.01", label: "Θεατρικών Σπουδών" },
  { code: "ΠΕ91.02", label: "Δραματικής Τέχνης" },
  // ΤΕ — Τεχνολογικής Εκπαίδευσης
  { code: "ΤΕ01.04", label: "Ψυκτικοί" },
  { code: "ΤΕ01.06", label: "Ηλεκτρολόγοι" },
  { code: "ΤΕ01.07", label: "Ηλεκτρονικοί" },
  { code: "ΤΕ01.13", label: "Προγραμματιστές Η/Υ" },
  { code: "ΤΕ01.19", label: "Κομμωτικής" },
  { code: "ΤΕ01.20", label: "Αισθητικής" },
  { code: "ΤΕ01.25", label: "Αργυροχρυσοχοΐας" },
  { code: "ΤΕ01.26", label: "Οδοντοτεχνικής" },
  { code: "ΤΕ01.29", label: "Βοηθών Ιατρ. & Βιολ. Εργαστηρίων" },
  { code: "ΤΕ01.30", label: "Βοηθοί Βρεφοκόμων - Παιδοκόμων" },
  { code: "ΤΕ01.31", label: "Χειριστές Ιατρικών Συσκευών (Βοηθ. Ακτιν.)" },
  { code: "ΤΕ02.01", label: "Σχεδιαστές-Δομικοί" },
  { code: "ΤΕ02.02", label: "Μηχανολόγοι" },
  { code: "ΤΕ02.03", label: "Χημικοί Εργαστηρίων" },
  { code: "ΤΕ02.04", label: "Οικονομίας-Διοίκησης" },
  { code: "ΤΕ02.05", label: "Εφαρμοσμένων Τεχνών" },
  { code: "ΤΕ02.06", label: "Σχεδιασμού και Παραγωγής Προϊόντων" },
  { code: "ΤΕ02.07", label: "Γεωπονίας" },
  { code: "ΤΕ16", label: "Μουσικής μη Ανωτάτων Ιδρυμάτων" },
  // ΔΕ — Δευτεροβάθμιας Εκπαίδευσης
  { code: "ΔΕ01", label: "Όλοι" },
  { code: "ΔΕ02.01", label: "Ηλεκτρολόγοι-Ηλεκτρονικοί" },
  { code: "ΔΕ02.02", label: "Μηχανολόγοι" },
  { code: "ΆΛΛΗ", label: "Άλλη Ειδικότητα" },
];

const GENERAL_EDUCATION_SPECIALTIES = [
  "ΠΕ01", "ΠΕ02", "ΠΕ03",
  "ΠΕ04.01", "ΠΕ04.02", "ΠΕ04.03", "ΠΕ04.04", "ΠΕ04.05",
  "ΠΕ05", "ΠΕ06", "ΠΕ07", "ΠΕ08", "ΠΕ11",
  "ΠΕ33", "ΠΕ34", "ΠΕ40", "ΠΕ60", "ΠΕ70", "ΠΕ78",
  "ΠΕ79.01", "ΠΕ79.02",
];

const roleLabels: Record<string, { label: string; variant: "blue" | "green" | "yellow" | "gray" }> = {
  supervisor: { label: "Επιτηρητής", variant: "blue" },
  presenter: { label: "Εισηγητής", variant: "green" },
  both: { label: "Εισηγητής & Επιτηρητής", variant: "yellow" },
};

function emptyForm() {
  return { firstName: "", lastName: "", specialty: "ΠΕ02", specialtyLabel: "", role: "both", educationType: "general" };
}

export default function TeachersPage() {
  const qc = useQueryClient();
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: async () => (await api.teachers.$get()).json() });
  const teacherList: Teacher[] = (teachers.data as any)?.teachers || [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [unavailOpen, setUnavailOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [unavailList, setUnavailList] = useState<TeacherUnavailable[]>([]);
  const [unavailForm, setUnavailForm] = useState({ date: "", shiftId: "" as string, reason: "" });
  const shifts = useQuery({ queryKey: ["shifts"], queryFn: async () => (await (api as any).shifts.$get()).json() });
  const shiftList: Shift[] = (shifts.data as any)?.shifts || [];
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({ firstName: t.firstName, lastName: t.lastName, specialty: t.specialty, specialtyLabel: t.specialtyLabel || "", role: t.role, educationType: t.educationType ?? "general" });
    setOpen(true);
  };

  const handleSpecialtyChange = (code: string) => {
    const spec = SPECIALTIES.find(s => s.code === code);
    setForm(f => ({ ...f, specialty: code, specialtyLabel: spec?.label || "", educationType: GENERAL_EDUCATION_SPECIALTIES.includes(code) ? "general" : "specialty" }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return (await (api.teachers as any)[":id"].$put({ param: { id: String(editing.id) }, json: form })).json();
      return (await api.teachers.$post({ json: form })).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await (api.teachers as any)[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  const openUnavail = async (t: Teacher) => {
    setSelectedTeacher(t);
    const res = await (api.teachers as any)[":id"].unavailable.$get({ param: { id: String(t.id) } });
    const data = await res.json();
    setUnavailList((data as any).unavailable || []);
    setUnavailOpen(true);
  };

  const addUnavail = useMutation({
    mutationFn: async () => {
      if (!selectedTeacher) return;
      const payload = {
        date: unavailForm.date,
        shiftId: unavailForm.shiftId ? parseInt(unavailForm.shiftId) : null,
        reason: unavailForm.reason || null,
      };
      const res = await (api.teachers as any)[":id"].unavailable.$post({ param: { id: String(selectedTeacher.id) }, json: payload });
      return res.json();
    },
    onSuccess: async () => {
      if (!selectedTeacher) return;
      const res = await (api.teachers as any)[":id"].unavailable.$get({ param: { id: String(selectedTeacher.id) } });
      const data = await res.json();
      setUnavailList((data as any).unavailable || []);
      setUnavailForm({ date: "", shiftId: "", reason: "" });
    },
  });

  const deleteUnavail = async (uid: number) => {
    if (!selectedTeacher) return;
    await (api.teachers as any)[":id"].unavailable[":uid"].$delete({ param: { id: String(selectedTeacher.id), uid: String(uid) } });
    const res = await (api.teachers as any)[":id"].unavailable.$get({ param: { id: String(selectedTeacher.id) } });
    const data = await res.json();
    setUnavailList((data as any).unavailable || []);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").slice(1);
      const list = lines.map((line) => {
        const [lastName, firstName, specialty, specialtyLabel, role] = line.split(",").map(s => s.trim().replace(/"/g, ""));
        const specCode = specialty || "ΠΕ02";
        return { lastName, firstName, specialty: specCode, specialtyLabel: specialtyLabel || "", role: role || "both", educationType: GENERAL_EDUCATION_SPECIALTIES.includes(specCode) ? "general" : "specialty" };
      }).filter(t => t.firstName && t.lastName);
      await (api.teachers as any).import.$post({ json: { teachers: list } });
      qc.invalidateQueries({ queryKey: ["teachers"] });
    };
    reader.readAsText(file, "UTF-8");
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = teacherList.filter((t) =>
    `${t.firstName} ${t.lastName} ${t.specialty} ${t.specialtyLabel}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Εκπαιδευτικοί</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{teacherList.length} εκπαιδευτικοί</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Import CSV
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={13} /> Νέος
          </Button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Αναζήτηση εκπαιδευτικού..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
      />

      {/* CSV hint */}
      <div className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
        CSV format: Επώνυμο, Όνομα, Ειδικότητα (ΠΕ02), Περιγραφή, Ρόλος (both/supervisor/presenter)
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#F8FAFF" }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Εκπαιδευτικός</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Ειδικότητα</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Ρόλος</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Τύπος</th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {teachers.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Users size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Δεν υπάρχουν εκπαιδευτικοί</p>
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => (
                <tr key={t.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, background: "var(--surface)" }}>
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: "var(--text)" }}>{t.lastName} {t.firstName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{t.specialty}</span>
                    {t.specialtyLabel && <span className="ml-2 text-xs" style={{ color: "var(--text-secondary)" }}>{t.specialtyLabel}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleLabels[t.role]?.variant || "gray"}>{roleLabels[t.role]?.label || t.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.educationType === "general" ? "green" : t.educationType === "both" ? "yellow" : "purple"}>{t.educationType === "general" ? "Γεν. Παιδεία" : t.educationType === "both" ? "Γεν. & Ειδικ." : "Ειδικότητα"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openUnavail(t)} className="p-1.5 rounded-lg hover:bg-orange-50" title="Μη διαθέσιμες μέρες">
                        <CalendarOff size={14} style={{ color: "var(--warning)" }} />
                      </button>
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        <Edit2 size={14} style={{ color: "var(--text-secondary)" }} />
                      </button>
                      <button onClick={() => del.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                        <Trash2 size={14} style={{ color: "var(--danger)" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Teacher form modal */}
      <Modal title={editing ? "Επεξεργασία Εκπαιδευτικού" : "Νέος Εκπαιδευτικός"} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Όνομα" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Γιάννης" />
            <Input label="Επώνυμο" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Παπαδόπουλος" />
          </div>
          <Select label="Ειδικότητα" value={form.specialty} onChange={(e) => handleSpecialtyChange(e.target.value)}>
            {SPECIALTIES.map(s => <option key={s.code} value={s.code}>{s.code} – {s.label}</option>)}
          </Select>
          <Select label="Ρόλος" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="both">Εισηγητής & Επιτηρητής</option>
            <option value="supervisor">Μόνο Επιτηρητής</option>
            <option value="presenter">Μόνο Εισηγητής</option>
          </Select>
          <Select label="Τύπος μαθημάτων" value={form.educationType} onChange={(e) => setForm({ ...form, educationType: e.target.value as "general" | "specialty" | "both" })}>
            <option value="general">Γενική Παιδεία</option>
            <option value="specialty">Ειδικότητα</option>
            <option value="both">Γενικής & Ειδικότητας</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Ακύρωση</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>Αποθήκευση</Button>
          </div>
        </div>
      </Modal>

      {/* Unavailability modal */}
      <Modal title={`Αδυναμία — ${selectedTeacher?.lastName} ${selectedTeacher?.firstName}`} open={unavailOpen} onClose={() => setUnavailOpen(false)} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ημερομηνία</label>
              <Input type="date" value={unavailForm.date} onChange={(e) => setUnavailForm({ ...unavailForm, date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Βάρδια</label>
              <Select value={unavailForm.shiftId} onChange={(e) => setUnavailForm({ ...unavailForm, shiftId: e.target.value })}>
                <option value="">Όλη η μέρα</option>
                {shiftList.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Αιτία (προαιρετικό)" value={unavailForm.reason} onChange={(e) => setUnavailForm({ ...unavailForm, reason: e.target.value })} />
            <Button onClick={() => addUnavail.mutate()} loading={addUnavail.isPending} disabled={!unavailForm.date} size="sm" className="flex-shrink-0">
              <Plus size={13} /> Προσθήκη
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {unavailList.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Διαθέσιμος/η όλες τις μέρες</p>
            ) : (
              unavailList.map((u) => {
                const shift = shiftList.find(s => s.id === u.shiftId);
                return (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                    <span className="text-sm" style={{ color: "#92400E" }}>
                      {new Date(u.date).toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "short" })}
                      {shift
                        ? <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "#FED7AA", color: "#7C2D12" }}>{shift.name}</span>
                        : <span className="ml-1 text-xs opacity-60">ολόκληρη η μέρα</span>
                      }
                      {u.reason && <span className="ml-1 opacity-70"> — {u.reason}</span>}
                    </span>
                    <button onClick={() => deleteUnavail(u.id)}>
                      <X size={14} style={{ color: "var(--danger)" }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setUnavailOpen(false)}>Κλείσιμο</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
