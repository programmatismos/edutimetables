import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Calendar, Users, BookOpen, GraduationCap, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const school = useQuery({ queryKey: ["school"], queryFn: async () => (await api.school.$get()).json() });
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: async () => (await api.teachers.$get()).json() });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: async () => (await api.subjects.$get()).json() });
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: async () => (await api.schedule.$get()).json() });
  const classes = useQuery({ queryKey: ["classes"], queryFn: async () => (await api.classes.$get()).json() });

  const schoolData = (school.data as any)?.school;
  const teacherList = (teachers.data as any)?.teachers || [];
  const subjectList = (subjects.data as any)?.subjects || [];
  const scheduleList = (schedule.data as any)?.schedule || [];
  const classesList = (classes.data as any)?.classes || [];

  const scheduledIds = new Set(scheduleList.map((s: any) => s.subjectId));
  const unscheduledCount = subjectList.filter((s: any) => !scheduledIds.has(s.id)).length;

  // Supervision counts
  const supCounts: Record<number, number> = {};
  for (const slot of scheduleList) {
    const ids: number[] = JSON.parse(slot.supervisorIds || "[]");
    const weight = slot.subject?.durationMinutes >= 180 ? 1.5 : 1;
    for (const id of ids) {
      supCounts[id] = (supCounts[id] || 0) + weight;
    }
  }
  const supValues = Object.values(supCounts);
  const avgSup = supValues.length ? (supValues.reduce((a, b) => a + b, 0) / supValues.length).toFixed(1) : "0";
  const maxSup = supValues.length ? Math.max(...supValues) : 0;
  const minSup = supValues.length ? Math.min(...supValues) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          {schoolData?.name || "EduTimetables"}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {schoolData?.type || "ΓΕΛ/ΕΠΑΛ"} · Πρόγραμμα Ενδοσχολικών Εξετάσεων
        </p>
      </div>

      {/* Period banner */}
      {schoolData?.examStart && schoolData?.examEnd && (
        <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: "var(--accent-light)", border: "1px solid #BFDBFE" }}>
          <Calendar size={20} style={{ color: "var(--accent)" }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>Εξεταστική Περίοδος: </span>
            <span className="text-sm" style={{ color: "var(--primary)" }}>
              {new Date(schoolData.examStart).toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" })}
              {" — "}
              {new Date(schoolData.examEnd).toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Εκπαιδευτικοί", value: teacherList.length, icon: Users, color: "#3B82F6", link: "/teachers" },
          { label: "Τάξεις / Τμήματα", value: classesList.length, icon: GraduationCap, color: "#8B5CF6", link: "/classes" },
          { label: "Μαθήματα", value: subjectList.length, icon: BookOpen, color: "#10B981", link: "/subjects" },
          { label: "Προγραμματισμένα", value: scheduleList.length, icon: Calendar, color: "#F59E0B", link: "/schedule" },
        ].map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link}>
            <div className="rounded-xl p-4 cursor-pointer hover:shadow-md transition-all" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                  <Icon size={18} style={{ color }} />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Schedule status */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text)" }}>Κατάσταση Προγράμματος</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Προγραμματισμένα μαθήματα</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{scheduledIds.size}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: unscheduledCount > 0 ? "var(--warning)" : "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Αδρομοποίητα μαθήματα</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: unscheduledCount > 0 ? "var(--warning)" : "var(--text)" }}>{unscheduledCount}</span>
            </div>
            {subjectList.length > 0 && (
              <div className="mt-2">
                <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      background: "var(--accent)",
                      width: `${Math.round((scheduledIds.size / subjectList.length) * 100)}%`
                    }}
                  />
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {Math.round((scheduledIds.size / subjectList.length) * 100)}% ολοκληρωμένο
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Supervision stats */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text)" }}>Ισοκατανομή Επιτηρήσεων</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Μέσος όρος</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{avgSup}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Μέγιστο</span>
              <span className="text-sm font-semibold" style={{ color: maxSup > parseFloat(avgSup) + 2 ? "var(--warning)" : "var(--text)" }}>{maxSup}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Ελάχιστο</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{minSup}</span>
            </div>
            {supValues.length > 0 && (
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                * Οι 3ωρες εξετάσεις μετράνε ως 1.5 επιτήρηση
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {!schoolData && (
        <div className="rounded-xl p-5" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#92400E" }}>Απαιτείται αρχική ρύθμιση</p>
              <p className="text-xs mt-1" style={{ color: "#B45309" }}>
                Ξεκίνα από τη σελίδα <strong>Σχολείο</strong> για να ορίσεις τα βασικά στοιχεία.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
