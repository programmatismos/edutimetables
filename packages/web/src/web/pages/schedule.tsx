import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Select, Input } from "../components/ui/Input";
import {
  Wand2, AlertTriangle, CheckCircle2, Trash2, Edit2,
  Calendar, RefreshCw, Plus, ChevronLeft, ChevronRight, Printer
} from "lucide-react";
import { Link } from "wouter";
import type { ExamSlot, Shift, Class, Teacher, Subject } from "../types";

const CLASS_COLORS = [
  "#DBEAFE", "#D1FAE5", "#FEF3C7", "#FCE7F3", "#EDE9FE",
  "#CFFAFE", "#FEE2E2", "#F0FDF4", "#FFF7ED", "#F0F4FF",
];

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const DAY_NAMES = ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"];
const DAY_NAMES_FULL = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

// ── Conflict detection (same rules as scheduler) ─────────────────────────────
type TeacherUnavailRecord = { teacherId: number; date: string; shiftId: number | null };

function isTeacherUnavailable(teacherId: number, date: string, shiftId: number, teacherUnavail: TeacherUnavailRecord[]): boolean {
  return teacherUnavail.some(u =>
    u.teacherId === teacherId &&
    u.date === date &&
    (u.shiftId === null || u.shiftId === shiftId)
  );
}

function detectConflicts(slot: ExamSlot, allSlots: ExamSlot[], unavailDates: Set<string>, teacherUnavail: TeacherUnavailRecord[] = []): string[] {
  const issues: string[] = [];
  const others = allSlots.filter(s => s.id !== slot.id);

  const supervisorIds: number[] = typeof slot.supervisorIds === "string"
    ? JSON.parse(slot.supervisorIds) : (slot.supervisorIds || []);

  // H1 — Απαγορευμένη ημερομηνία σχολείου
  if (unavailDates.has(slot.date)) {
    issues.push("Η ημερομηνία είναι αργία/αναστολή");
  }

  // H2 — Εκπαιδευτικός σε αδυναμία (whole-day or specific shift)
  if (slot.presenterId && isTeacherUnavailable(slot.presenterId, slot.date, slot.shiftId, teacherUnavail)) {
    issues.push(`Ο εισηγητής ${slot.presenter?.lastName} έχει δηλώσει αδυναμία αυτή την ώρα`);
  }
  for (const supId of supervisorIds) {
    if (isTeacherUnavailable(supId, slot.date, slot.shiftId, teacherUnavail)) {
      const sup = slot.supervisors?.find(t => t.id === supId);
      issues.push(`Ο επιτηρητής ${sup?.lastName || supId} έχει δηλώσει αδυναμία αυτή την ώρα`);
    }
  }

  // H3 — Ίδια τάξη ίδια βάρδια
  const sameClassSameShift = others.filter(s =>
    s.date === slot.date &&
    s.shiftId === slot.shiftId &&
    s.class?.id === slot.class?.id &&
    slot.class != null
  );
  if (sameClassSameShift.length > 0) {
    issues.push(`Η τάξη ${slot.class?.label} έχει ήδη εξέταση στην ίδια βάρδια`);
  }

  // H4 — Ίδια τάξη ίδια μέρα (max 1/day)
  const sameClassSameDay = others.filter(s =>
    s.date === slot.date &&
    s.class?.id === slot.class?.id &&
    slot.class != null
  );
  if (sameClassSameDay.length > 0) {
    issues.push(`Η τάξη ${slot.class?.label} έχει ήδη εξέταση την ίδια ημέρα`);
  }

  // H5 — Εισηγητής παρουσιάζει αλλού την ίδια βάρδια
  if (slot.presenterId) {
    const presenterBusy = others.filter(s =>
      s.date === slot.date &&
      s.shiftId === slot.shiftId &&
      s.presenterId === slot.presenterId
    );
    if (presenterBusy.length > 0) {
      issues.push(`Ο εισηγητής ${slot.presenter?.lastName} έχει άλλη εξέταση στην ίδια βάρδια`);
    }
  }

  // H6 — Εισηγητής είναι και επιτηρητής αλλού την ίδια βάρδια
  if (slot.presenterId) {
    const presenterAsSup = others.filter(s => {
      const ids: number[] = typeof s.supervisorIds === "string" ? JSON.parse(s.supervisorIds) : (s.supervisorIds || []);
      return s.date === slot.date && s.shiftId === slot.shiftId && ids.includes(slot.presenterId!);
    });
    if (presenterAsSup.length > 0) {
      issues.push(`Ο εισηγητής ${slot.presenter?.lastName} είναι επιτηρητής σε άλλη εξέταση την ίδια βάρδια`);
    }
  }

  // Επιτηρητής επιτηρεί αλλού την ίδια βάρδια
  for (const supId of supervisorIds) {
    const supBusy = others.filter(s => {
      const ids: number[] = typeof s.supervisorIds === "string" ? JSON.parse(s.supervisorIds) : (s.supervisorIds || []);
      return s.date === slot.date && s.shiftId === slot.shiftId && ids.includes(supId);
    });
    if (supBusy.length > 0) {
      const sup = slot.supervisors?.find(t => t.id === supId);
      issues.push(`Ο επιτηρητής ${sup?.lastName || supId} επιτηρεί ήδη άλλη εξέταση την ίδια βάρδια`);
    }
    // Επιτηρητής είναι εισηγητής αλλού την ίδια βάρδια
    const supAsPresenter = others.filter(s =>
      s.date === slot.date && s.shiftId === slot.shiftId && s.presenterId === supId
    );
    if (supAsPresenter.length > 0) {
      const sup = slot.supervisors?.find(t => t.id === supId);
      issues.push(`Ο επιτηρητής ${sup?.lastName || supId} είναι εισηγητής σε άλλη εξέταση την ίδια βάρδια`);
    }
  }

  return issues;
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const school = useQuery({ queryKey: ["school"], queryFn: async () => (await api.school.$get()).json() });
  const shifts = useQuery({ queryKey: ["shifts"], queryFn: async () => (await api.shifts.$get()).json() });
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: async () => (await api.schedule.$get()).json() });
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: async () => (await api.teachers.$get()).json() });
  const classes = useQuery({ queryKey: ["classes"], queryFn: async () => (await api.classes.$get()).json() });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: async () => (await api.subjects.$get()).json() });
  const schoolUnavail = useQuery({ queryKey: ["school-unavail"], queryFn: async () => (await api.school.unavailable.$get()).json() });
  const teacherUnavailQuery = useQuery({ queryKey: ["teachers-all-unavail"], queryFn: async () => (await (api.teachers as any)["all-unavailable"].$get()).json() });

  const schoolData = (school.data as any)?.school;
  const shiftList: Shift[] = (shifts.data as any)?.shifts || [];
  const scheduleList: ExamSlot[] = (schedule.data as any)?.schedule || [];
  const teacherList: Teacher[] = (teachers.data as any)?.teachers || [];
  const classList: Class[] = (classes.data as any)?.classes || [];
  const subjectList: Subject[] = (subjects.data as any)?.subjects || [];
  const unavailDates = new Set(((schoolUnavail.data as any)?.unavailable || []).map((u: any) => u.date));
  const teacherUnavail: TeacherUnavailRecord[] = (teacherUnavailQuery.data as any)?.unavailable || [];

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<ExamSlot | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addShiftId, setAddShiftId] = useState<number>(0);

  // Edit form
  const [editForm, setEditForm] = useState<{ subjectId: number; presenterId: number; supervisorIds: number[]; notes: string; date: string; shiftId: number }>({
    subjectId: 0, presenterId: 0, supervisorIds: [], notes: "", date: "", shiftId: 0
  });

  const [addForm, setAddForm] = useState({ subjectId: 0, presenterId: 0, supervisorIds: [] as number[], notes: "" });

  // Class color mapping
  const classColorMap: Record<number, string> = {};
  classList.forEach((c, i) => { classColorMap[c.id] = CLASS_COLORS[i % CLASS_COLORS.length]; });

  const generate = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      const res = await (api.generate as any).$post({ json: { clearManual: true } });
      return res.json();
    },
    onSuccess: (data) => {
      setGenerating(false);
      setGenResult(data);
      setGenOpen(true);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: () => setGenerating(false),
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: number) => (await (api.schedule as any)[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => (await (api.schedule as any).$delete()).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); },
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editSlot) return;
      return (await (api.schedule as any)[":id"].$put({
        param: { id: String(editSlot.id) },
        json: { ...editForm, isManuallyPlaced: true, supervisorIds: editForm.supervisorIds }
      })).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setEditOpen(false); },
  });

  const saveAdd = useMutation({
    mutationFn: async () => {
      return (await api.schedule.$post({ json: { ...addForm, date: addDate, shiftId: addShiftId, isManuallyPlaced: true, supervisorIds: addForm.supervisorIds } })).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setAddOpen(false); },
  });

  const openEdit = (slot: ExamSlot) => {
    setEditSlot(slot);
    const ids: number[] = typeof slot.supervisorIds === "string" ? JSON.parse(slot.supervisorIds) : (slot.supervisorIds || []);
    setEditForm({
      subjectId: slot.subjectId,
      presenterId: slot.presenterId || 0,
      supervisorIds: ids,
      notes: slot.notes || "",
      date: slot.date,
      shiftId: slot.shiftId,
    });
    setEditOpen(true);
  };

  const openAdd = (date: string, shiftId: number) => {
    setAddDate(date);
    setAddShiftId(shiftId);
    setAddForm({ subjectId: 0, presenterId: 0, supervisorIds: [], notes: "" });
    setAddOpen(true);
  };

  // Build calendar view
  const allDates = schoolData?.examStart && schoolData?.examEnd
    ? getDateRange(schoolData.examStart, schoolData.examEnd)
    : [];

  const [weekOffset, setWeekOffset] = useState(0);

  // Group dates by week
  const firstDateIdx = weekOffset * 7;
  const visibleDates = allDates.slice(firstDateIdx, firstDateIdx + 7);
  const totalWeeks = Math.ceil(allDates.length / 7);

  // Index slots by date + shift
  const slotIndex: Record<string, ExamSlot[]> = {};
  for (const slot of scheduleList) {
    const key = `${slot.date}_${slot.shiftId}`;
    if (!slotIndex[key]) slotIndex[key] = [];
    slotIndex[key].push(slot);
  }

  // Supervision counts for display
  const supCounts: Record<number, number> = {};
  for (const t of teacherList) supCounts[t.id] = 0;
  for (const slot of scheduleList) {
    const ids: number[] = typeof slot.supervisorIds === "string" ? JSON.parse(slot.supervisorIds) : [];
    const weight = slot.subject?.durationMinutes >= 180 ? 1.5 : 1;
    for (const id of ids) supCounts[id] = (supCounts[id] || 0) + weight;
  }

  const isLoading = school.isLoading || shifts.isLoading || schedule.isLoading;

  if (!schoolData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={36} style={{ color: "var(--warning)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Ορίσε πρώτα τα στοιχεία σχολείου και την εξεταστική περίοδο.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Πρόγραμμα Εξετάσεων</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {scheduleList.length} εξετάσεις · {subjectList.length - new Set(scheduleList.map(s => s.subjectId)).size} αδρομοποίητα
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/exports">
            <Button variant="secondary" size="sm">
              <Printer size={13} /> Εκτύπωση / Export
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => clearAll.mutate()} loading={clearAll.isPending}>
            <Trash2 size={13} /> Καθαρισμός
          </Button>
          <Button size="sm" onClick={() => generate.mutate()} loading={generating}>
            <Wand2 size={13} /> Αυτόματη Δημιουργία
          </Button>
        </div>
      </div>

      {/* Supervision balance bar */}
      {teacherList.length > 0 && scheduleList.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Κατανομή Επιτηρήσεων</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>3ωρο = 1.5x</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {teacherList
              .sort((a, b) => (supCounts[b.id] || 0) - (supCounts[a.id] || 0))
              .map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: "#F8FAFF", border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{t.lastName}</span>
                  <span className="font-bold" style={{ color: supCounts[t.id] >= 5 ? "var(--danger)" : supCounts[t.id] >= 3 ? "var(--warning)" : "var(--success)" }}>
                    {supCounts[t.id] || 0}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Calendar navigation */}
      {allDates.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Εβδομάδα {weekOffset + 1} / {totalWeeks}
          </span>
          <button
            onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
            disabled={weekOffset >= totalWeeks - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Calendar grid */}
      {isLoading ? (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Φόρτωση...</div>
      ) : shiftList.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Calendar size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ορίσε πρώτα τις βάρδιες.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
          {/* Header row */}
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${visibleDates.length}, minmax(120px, 1fr))`, background: "var(--primary)", minWidth: `calc(140px + ${visibleDates.length} * 120px)` }}>
            <div className="px-3 py-3 text-xs font-semibold text-white/60">Βάρδια</div>
            {visibleDates.map((date) => {
              const d = new Date(date);
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isUnavail = unavailDates.has(date);
              return (
                <div key={date} className={`px-2 py-3 text-center ${isWeekend || isUnavail ? "opacity-40" : ""}`}>
                  <div className="text-xs text-white/60">{DAY_NAMES[dow]}</div>
                  <div className="text-sm font-semibold text-white">{d.getDate()}/{d.getMonth() + 1}</div>
                  {isUnavail && <div className="text-xs text-white/40">κλειστό</div>}
                </div>
              );
            })}
          </div>

          {/* Shift rows */}
          {shiftList.map((shift) => (
            <div
              key={shift.id}
              className="grid"
              style={{
                gridTemplateColumns: `140px repeat(${visibleDates.length}, minmax(120px, 1fr))`,
                minWidth: `calc(140px + ${visibleDates.length} * 120px)`,
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              {/* Shift label */}
              <div className="px-3 py-3 border-r" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>{shift.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{shift.startTime}–{shift.endTime}</div>
              </div>

              {/* Day cells */}
              {visibleDates.map((date) => {
                const d = new Date(date);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isUnavail = unavailDates.has(date);
                const key = `${date}_${shift.id}`;
                const slots = slotIndex[key] || [];
                const disabled = isWeekend || isUnavail;

                return (
                  <div
                    key={date}
                    className="border-l min-h-16 p-1.5 relative"
                    style={{
                      borderColor: "var(--border)",
                      background: disabled ? "#F8FAFF" : "var(--surface)",
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {disabled ? (
                      <div className="text-xs text-center pt-3" style={{ color: "var(--text-muted)" }}>—</div>
                    ) : (
                      <>
                        {slots.map((slot) => {
                          const cls = slot.class || classList.find(c => c.id === slot.subject?.classId);
                          const bg = cls ? classColorMap[cls.id] || "#DBEAFE" : "#DBEAFE";
                          const ids: number[] = typeof slot.supervisorIds === "string" ? JSON.parse(slot.supervisorIds) : [];
                          const sups = ids.map(id => teacherList.find(t => t.id === id)).filter(Boolean);
                          const conflicts = detectConflicts(slot, scheduleList, unavailDates, teacherUnavail);
                          const hasConflict = conflicts.length > 0;
                          return (
                            <div
                              key={slot.id}
                              className="rounded-md px-2 py-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity relative"
                              style={{
                                background: bg,
                                border: hasConflict ? "2px solid #EF4444" : `1px solid ${bg}`,
                              }}
                              onClick={() => openEdit(slot)}
                              title={hasConflict ? conflicts.join("\n") : undefined}
                            >
                              {hasConflict && (
                                <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-xs font-bold"
                                  style={{ background: "#FEF2F2", color: "#EF4444", fontSize: 9, lineHeight: 1 }}>
                                  <AlertTriangle size={9} /> {conflicts.length}
                                </div>
                              )}
                              <div className="text-xs font-semibold truncate pr-6" style={{ color: "var(--primary)" }}>
                                {slot.subject?.name || "Μάθημα"}
                              </div>
                              <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                                {cls?.label}
                              </div>
                              {slot.presenter && (
                                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                                  Εισ: {slot.presenter.lastName}
                                </div>
                              )}
                              {sups.length > 0 && (
                                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                                  Επιτ: {sups.map(s => s?.lastName).join(", ")}
                                </div>
                              )}
                              {slot.notes?.includes("split") && (
                                <div className="text-xs mt-0.5 font-medium" style={{ color: "#D97706" }}>⇌ {slot.notes}</div>
                              )}
                              {slot.isManuallyPlaced && (
                                <div className="text-xs mt-0.5" style={{ color: "#7C3AED" }}>✎ χειροκ.</div>
                              )}
                              {hasConflict && (
                                <div className="mt-1 space-y-0.5">
                                  {conflicts.map((c, i) => (
                                    <div key={i} className="text-xs rounded px-1 py-0.5" style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 8, lineHeight: 1.3 }}>
                                      ⚠ {c}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!disabled && (
                          <button
                            onClick={() => openAdd(date, shift.id)}
                            className="w-full text-xs rounded flex items-center justify-center gap-1 py-1 hover:bg-blue-50 transition-colors"
                            style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
                          >
                            <Plus size={10} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          </div>{/* end overflow-x-auto */}
        </div>
      )}

      {/* Generation result modal */}
      <Modal title="Αποτέλεσμα Αυτόματης Δημιουργίας" open={genOpen} onClose={() => setGenOpen(false)} size="lg">
        {genResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ background: "#D1FAE5" }}>
                <div className="text-2xl font-bold" style={{ color: "#065F46" }}>{genResult.placed}</div>
                <div className="text-xs" style={{ color: "#065F46" }}>Προγραμματίστηκαν</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: genResult.unscheduled?.length > 0 ? "#FEE2E2" : "#D1FAE5" }}>
                <div className="text-2xl font-bold" style={{ color: genResult.unscheduled?.length > 0 ? "#991B1B" : "#065F46" }}>{genResult.unscheduled?.length || 0}</div>
                <div className="text-xs" style={{ color: genResult.unscheduled?.length > 0 ? "#991B1B" : "#065F46" }}>Αδρομοποίητα</div>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "#DBEAFE" }}>
                <div className="text-2xl font-bold" style={{ color: "#1D4ED8" }}>{Math.round(genResult.score || 0)}</div>
                <div className="text-xs" style={{ color: "#1D4ED8" }}>Score</div>
              </div>
            </div>
            {genResult.violations?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--warning)" }}>Παρατηρήσεις:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {genResult.violations.map((v: string, i: number) => (
                    <div key={i} className="text-xs px-3 py-1.5 rounded" style={{ background: "#FFF7ED", color: "#92400E" }}>
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full justify-center" onClick={() => setGenOpen(false)}>
              <CheckCircle2 size={14} /> Εντάξει
            </Button>
          </div>
        )}
      </Modal>

      {/* Edit slot modal */}
      <Modal title="Επεξεργασία Εξέτασης" open={editOpen} onClose={() => setEditOpen(false)} size="xl">
        {editSlot && (
          <div className="space-y-4">
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--accent-light)", color: "var(--primary)" }}>
              <strong>{editSlot.subject?.name}</strong> · {editSlot.class?.label}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ημερομηνία" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              <Select label="Βάρδια" value={String(editForm.shiftId)} onChange={(e) => setEditForm({ ...editForm, shiftId: parseInt(e.target.value) })}>
                {shiftList.map(s => <option key={s.id} value={String(s.id)}>{s.name} ({s.startTime}–{s.endTime})</option>)}
              </Select>
            </div>
            <Select label="Εισηγητής" value={String(editForm.presenterId)} onChange={(e) => setEditForm({ ...editForm, presenterId: parseInt(e.target.value) })}>
              <option value="0">Χωρίς εισηγητή</option>
              {teacherList.map(t => <option key={t.id} value={String(t.id)}>{t.lastName} {t.firstName}</option>)}
            </Select>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Επιτηρητές</label>
              <div className="flex flex-wrap gap-2">
                {teacherList.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.supervisorIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) setEditForm(f => ({ ...f, supervisorIds: [...f.supervisorIds, t.id] }));
                        else setEditForm(f => ({ ...f, supervisorIds: f.supervisorIds.filter(id => id !== t.id) }));
                      }}
                    />
                    <span style={{ color: "var(--text)" }}>{t.lastName} {t.firstName}</span>
                  </label>
                ))}
              </div>
            </div>
            <Input label="Σημειώσεις" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Προαιρετικά..." />
            <div className="flex justify-between">
              <Button variant="danger" onClick={() => { deleteSlot.mutate(editSlot.id); setEditOpen(false); }} loading={deleteSlot.isPending} size="sm">
                <Trash2 size={13} /> Διαγραφή
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)}>Ακύρωση</Button>
                <Button onClick={() => saveEdit.mutate()} loading={saveEdit.isPending}>Αποθήκευση</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add slot modal */}
      <Modal title={`Νέα Εξέταση — ${addDate ? new Date(addDate).toLocaleDateString("el-GR", { weekday: "long", day: "2-digit", month: "long" }) : ""}`} open={addOpen} onClose={() => setAddOpen(false)} size="xl">
        <div className="space-y-4">
          <Select label="Μάθημα" value={String(addForm.subjectId)} onChange={(e) => setAddForm({ ...addForm, subjectId: parseInt(e.target.value), presenterId: subjectList.find(s => s.id === parseInt(e.target.value))?.presenterId || 0 })}>
            <option value="0">Επιλογή μαθήματος...</option>
            {subjectList.map(s => <option key={s.id} value={String(s.id)}>{s.name} ({s.class?.label || ""})</option>)}
          </Select>
          <Select label="Εισηγητής" value={String(addForm.presenterId)} onChange={(e) => setAddForm({ ...addForm, presenterId: parseInt(e.target.value) })}>
            <option value="0">Χωρίς εισηγητή</option>
            {teacherList.map(t => <option key={t.id} value={String(t.id)}>{t.lastName} {t.firstName}</option>)}
          </Select>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Επιτηρητές</label>
            <div className="flex flex-wrap gap-2">
              {teacherList.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.supervisorIds.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setAddForm(f => ({ ...f, supervisorIds: [...f.supervisorIds, t.id] }));
                      else setAddForm(f => ({ ...f, supervisorIds: f.supervisorIds.filter(id => id !== t.id) }));
                    }}
                  />
                  <span style={{ color: "var(--text)" }}>{t.lastName} {t.firstName}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Ακύρωση</Button>
            <Button onClick={() => saveAdd.mutate()} loading={saveAdd.isPending} disabled={!addForm.subjectId}>Αποθήκευση</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
