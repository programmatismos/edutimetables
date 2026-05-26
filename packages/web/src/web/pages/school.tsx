import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, safeJson } from "../lib/api";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Plus, Trash2, Save, School, CalendarOff, RotateCcw } from "lucide-react";

export default function SchoolPage() {
  const qc = useQueryClient();
  const school = useQuery({ queryKey: ["school"], queryFn: async () => safeJson(api.school.$get()) });
  const unavail = useQuery({ queryKey: ["school-unavail"], queryFn: async () => safeJson(api.school.unavailable.$get()) });

  const schoolData = (school.data as any)?.school;
  const unavailList = (unavail.data as any)?.unavailable || [];

  const [form, setForm] = useState({ name: "", type: "ΓΕΛ", examStart: "", examEnd: "" });
  const [addUnavailOpen, setAddUnavailOpen] = useState(false);
  const [unavailForm, setUnavailForm] = useState({ date: "", reason: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    if (schoolData) {
      setForm({
        name: schoolData.name || "",
        type: schoolData.type || "ΓΕΛ",
        examStart: schoolData.examStart || "",
        examEnd: schoolData.examEnd || "",
      });
    }
  }, [schoolData]);

  const saveSchool = useMutation({
    mutationFn: async () => safeJson(api.school.$post({ json: form })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school"] }),
    onError: (err: any) => alert(`Σφάλμα αποθήκευσης: ${err?.message || JSON.stringify(err)}`),
  });

  const addUnavail = useMutation({
    mutationFn: async () => safeJson(api.school.unavailable.$post({ json: unavailForm })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["school-unavail"] }); setAddUnavailOpen(false); setUnavailForm({ date: "", reason: "" }); },
    onError: (err: any) => alert(`Σφάλμα αδυναμίας: ${err?.message || JSON.stringify(err)}`),
  });

  const deleteUnavail = useMutation({
    mutationFn: async (id: number) => safeJson((api.school.unavailable as any)[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-unavail"] }),
    onError: (err: any) => alert(`Σφάλμα διαγραφής: ${err?.message || JSON.stringify(err)}`),
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => safeJson(api.reset.$post()),
    onSuccess: () => {
      setResetConfirmOpen(false);
      qc.invalidateQueries();
    },
    onError: (err: any) => alert(`Σφάλμα επαναφοράς: ${err?.message || JSON.stringify(err)}`),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Στοιχεία Σχολείου</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Βασικές πληροφορίες και εξεταστική περίοδος</p>
      </div>

      {/* School form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <School size={16} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Γενικές Πληροφορίες</h2>
        </div>

        <Input
          label="Όνομα Σχολικής Μονάδας"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="π.χ. 1ο ΓΕΛ Αθήνας"
        />

        <Select label="Τύπος Σχολείου" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="ΓΕΛ">ΓΕΛ – Γενικό Λύκειο</option>
          <option value="ΕΠΑΛ">ΕΠΑΛ – Επαγγελματικό Λύκειο</option>
          <option value="ΓΕΛ/ΕΠΑΛ">ΓΕΛ & ΕΠΑΛ</option>
          <option value="ΓΥΜΝΑΣΙΟ">Γυμνάσιο</option>
          <option value="ΣΑΕΚ">Μεταλυκειακό Επίπεδο (ΣΑΕΚ)</option>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Έναρξη Εξεταστικής"
            type="date"
            value={form.examStart}
            onChange={(e) => setForm({ ...form, examStart: e.target.value })}
          />
          <Input
            label="Λήξη Εξεταστικής"
            type="date"
            value={form.examEnd}
            onChange={(e) => setForm({ ...form, examEnd: e.target.value })}
          />
        </div>

        <Button onClick={() => saveSchool.mutate()} loading={saveSchool.isPending} className="w-full justify-center">
          <Save size={14} /> Αποθήκευση
        </Button>
      </div>

      {/* Unavailable days */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff size={16} style={{ color: "var(--warning)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Μη Διαθέσιμες Ημέρες</h2>
          </div>
          <Button size="sm" onClick={() => setAddUnavailOpen(true)}>
            <Plus size={13} /> Προσθήκη
          </Button>
        </div>

        {unavail.isLoading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</div>
        ) : unavailList.length === 0 ? (
          <div className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Δεν υπάρχουν μη διαθέσιμες ημέρες</div>
        ) : (
          <div className="space-y-2">
            {unavailList.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                <div>
                  <span className="text-sm font-medium" style={{ color: "#92400E" }}>
                    {new Date(u.date).toLocaleDateString("el-GR", { weekday: "long", day: "2-digit", month: "long" })}
                  </span>
                  {u.reason && <span className="text-xs ml-2" style={{ color: "#B45309" }}>({u.reason})</span>}
                </div>
                <button onClick={() => deleteUnavail.mutate(u.id)} className="p-1 hover:bg-red-100 rounded">
                  <Trash2 size={14} style={{ color: "var(--danger)" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset to defaults */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--danger-border, #FCA5A5)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm" style={{ color: "var(--danger, #DC2626)" }}>Επαναφορά σε Προεπιλογές</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Διαγράφει όλα τα δεδομένα (σχολείο, βάρδιες, τάξεις, μαθήματα, εκπαιδευτικούς) και επαναφέρει τα εργοστασιακά defaults.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw size={13} /> Επαναφορά
          </Button>
        </div>
      </div>

      {/* Reset confirm dialog */}
      <Modal title="Επαναφορά σε Προεπιλογές" open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text)" }}>
            Αυτή η ενέργεια θα <strong>διαγράψει μόνιμα</strong> όλα τα δεδομένα:
          </p>
          <ul className="text-sm space-y-1 pl-4 list-disc" style={{ color: "var(--text-secondary)" }}>
            <li>Στοιχεία σχολείου & εξεταστική περίοδος</li>
            <li>Βάρδιες</li>
            <li>Τάξεις & μαθήματα</li>
            <li>Εκπαιδευτικοί</li>
            <li>Πρόγραμμα εξετάσεων</li>
          </ul>
          <p className="text-sm font-medium" style={{ color: "var(--danger, #DC2626)" }}>
            Δεν μπορεί να αναιρεθεί. Συνέχεια;
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setResetConfirmOpen(false)}>Ακύρωση</Button>
            <Button variant="danger" onClick={() => resetToDefaults.mutate()} loading={resetToDefaults.isPending}>
              Ναι, Επαναφορά
            </Button>
          </div>
        </div>
      </Modal>

      <Modal title="Προσθήκη Μη Διαθέσιμης Ημέρας" open={addUnavailOpen} onClose={() => setAddUnavailOpen(false)}>
        <div className="space-y-4">
          <Input
            label="Ημερομηνία"
            type="date"
            value={unavailForm.date}
            onChange={(e) => setUnavailForm({ ...unavailForm, date: e.target.value })}
          />
          <Input
            label="Αιτία (προαιρετικό)"
            value={unavailForm.reason}
            onChange={(e) => setUnavailForm({ ...unavailForm, reason: e.target.value })}
            placeholder="π.χ. Αργία, Σχολική εκδήλωση"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddUnavailOpen(false)}>Ακύρωση</Button>
            <Button onClick={() => addUnavail.mutate()} loading={addUnavail.isPending}>Αποθήκευση</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
