import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { useState } from "react";
import { Printer, FileSpreadsheet, FileDown, Calendar, Sheet, FileText } from "lucide-react";
import type { ExamSlot } from "../types";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, HeadingLevel,
  PageOrientation,
} from "docx";

const DAY_NAMES_FULL = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

function formatDate(d: string) {
  const dt = new Date(d);
  return `${DAY_NAMES_FULL[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

function groupByDate(slots: ExamSlot[]): Record<string, ExamSlot[]> {
  return slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, ExamSlot[]>);
}

function escapeCSV(val: any): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Print table — ένας ενιαίος πίνακας ──
function PrintTable({ slots, schoolName }: { slots: ExamSlot[]; schoolName: string }) {
  const sorted = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.shift?.order || 0) - (b.shift?.order || 0);
  });

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#111", width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: "bold" }}>{schoolName}</div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>Πρόγραμμα Εξετάσεων</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "7%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#ccc" }}>
            {["Ημερομηνία", "Βάρδια", "Μάθημα", "Τάξη", "Εισηγητής", "Επιτηρητές", "Διάρκ.", "Σημ."].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((slot, i) => {
            const isNewDay = i === 0 || sorted[i - 1].date !== slot.date;
            const supervisors = (slot.supervisors || []).map(t => `${t.lastName} ${t.firstName}`).join(", ");
            const presenter = slot.presenter ? `${slot.presenter.lastName} ${slot.presenter.firstName}` : "—";
            const cls = [slot.class?.grade, slot.class?.department].filter(Boolean).join(" ");
            return (
              <tr key={slot.id} style={{ background: isNewDay && i !== 0 ? "#f0f0f0" : i % 2 === 0 ? "#fff" : "#f8f8f8" }}>
                <td style={{ ...tdStyle, fontWeight: isNewDay ? "bold" : "normal", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>
                  {isNewDay ? formatDate(slot.date) : ""}
                </td>
                <td style={{ ...tdStyle, borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{slot.shift?.name || "—"}</td>
                <td style={{ ...tdStyle, wordBreak: "break-word", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{slot.subject?.name || "—"}</td>
                <td style={{ ...tdStyle, borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{cls || "—"}</td>
                <td style={{ ...tdStyle, wordBreak: "break-word", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{presenter}</td>
                <td style={{ ...tdStyle, wordBreak: "break-word", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{supervisors || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{slot.subject?.durationMinutes ? `${slot.subject.durationMinutes}'` : "—"}</td>
                <td style={{ ...tdStyle, wordBreak: "break-word", borderTop: isNewDay && i !== 0 ? "2px solid #999" : tdStyle.border }}>{slot.notes || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #555",
  padding: "3px 4px",
  textAlign: "left",
  fontWeight: "bold",
  fontSize: 8,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #bbb",
  padding: "2px 4px",
  fontSize: 8,
  verticalAlign: "top",
};

export default function ExportsPage() {
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: async () => (await api.schedule.$get()).json() });
  const school = useQuery({ queryKey: ["school"], queryFn: async () => (await api.school.$get()).json() });
  const [isPrinting, setIsPrinting] = useState(false);

  const schoolData = (school.data as any)?.school;
  const schoolName = schoolData?.name || "Σχολείο";
  const slots: ExamSlot[] = (schedule.data as any)?.schedule || [];
  const grouped = groupByDate(slots);
  const sortedDates = Object.keys(grouped).sort();

  function triggerPrint() {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 800);
    }, 200);
  }

  function exportExcel() {
    const sorted = [...slots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.shift?.order || 0) - (b.shift?.order || 0);
    });

    const headers = ["Ημερομηνία", "Ημέρα", "Βάρδια", "Μάθημα", "Τάξη", "Τμήμα", "Εισηγητής", "Επιτηρητές", "Διάρκεια (λεπτά)", "Σημειώσεις"];
    const rows = sorted.map(slot => {
      const dt = new Date(slot.date);
      return [
        slot.date,
        DAY_NAMES_FULL[dt.getDay()],
        slot.shift?.name || "",
        slot.subject?.name || "",
        slot.class?.grade || "",
        slot.class?.department || "",
        slot.presenter ? `${slot.presenter.lastName} ${slot.presenter.firstName}` : "",
        (slot.supervisors || []).map(t => `${t.lastName} ${t.firstName}`).join(", "),
        slot.subject?.durationMinutes || "",
        slot.notes || "",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws["!cols"] = [
      { wch: 14 }, // Ημερομηνία
      { wch: 12 }, // Ημέρα
      { wch: 12 }, // Βάρδια
      { wch: 30 }, // Μάθημα
      { wch: 8 },  // Τάξη
      { wch: 10 }, // Τμήμα
      { wch: 22 }, // Εισηγητής
      { wch: 40 }, // Επιτηρητές
      { wch: 8 },  // Διάρκεια
      { wch: 20 }, // Σημ.
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Πρόγραμμα");

    // Second sheet: per teacher
    const teacherHeaders = ["Εκπαιδευτικός", "Ειδικότητα", "Ρόλος", "Ημερομηνία", "Ημέρα", "Βάρδια", "Μάθημα", "Τάξη"];
    const teacherRows: any[][] = [];
    for (const slot of sorted) {
      const dt = new Date(slot.date);
      const day = DAY_NAMES_FULL[dt.getDay()];
      const cls = [slot.class?.grade, slot.class?.department].filter(Boolean).join(" ");
      if (slot.presenter) teacherRows.push([`${slot.presenter.lastName} ${slot.presenter.firstName}`, slot.presenter.specialty || "", "Εισηγητής", slot.date, day, slot.shift?.name || "", slot.subject?.name || "", cls]);
      for (const sup of slot.supervisors || []) teacherRows.push([`${sup.lastName} ${sup.firstName}`, sup.specialty || "", "Επιτηρητής", slot.date, day, slot.shift?.name || "", slot.subject?.name || "", cls]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet([teacherHeaders, ...teacherRows]);
    ws2["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "ανά Εκπαιδευτικό");

    XLSX.writeFile(wb, "programma_exetaseon.xlsx");
  }

  function exportWord() {
    const sorted = [...slots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.shift?.order || 0) - (b.shift?.order || 0);
    });

    const border = {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    };

    function cell(text: string, bold = false, bg?: string, width?: number): TableCell {
      return new TableCell({
        borders: border,
        shading: bg ? { fill: bg } : undefined,
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold, size: 16, font: "Arial" })],
          }),
        ],
      });
    }

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        cell("Ημερομηνία", true, "CCCCCC", 1800),
        cell("Βάρδια", true, "CCCCCC", 900),
        cell("Μάθημα", true, "CCCCCC", 2400),
        cell("Τάξη", true, "CCCCCC", 700),
        cell("Εισηγητής", true, "CCCCCC", 1600),
        cell("Επιτηρητές", true, "CCCCCC", 3200),
        cell("Διάρκ.", true, "CCCCCC", 600),
        cell("Σημ.", true, "CCCCCC", 1000),
      ],
    });

    const dataRows = sorted.map((slot, i) => {
      const isNewDay = i === 0 || sorted[i - 1].date !== slot.date;
      const supervisors = (slot.supervisors || []).map(t => `${t.lastName} ${t.firstName}`).join(", ");
      const presenter = slot.presenter ? `${slot.presenter.lastName} ${slot.presenter.firstName}` : "—";
      const cls = [slot.class?.grade, slot.class?.department].filter(Boolean).join(" ");
      const bg = isNewDay && i !== 0 ? "F0F0F0" : i % 2 === 0 ? "FFFFFF" : "F8F8F8";

      return new TableRow({
        children: [
          cell(isNewDay ? formatDate(slot.date) : "", isNewDay, bg, 1800),
          cell(slot.shift?.name || "—", false, bg, 900),
          cell(slot.subject?.name || "—", false, bg, 2400),
          cell(cls || "—", false, bg, 700),
          cell(presenter, false, bg, 1600),
          cell(supervisors || "—", false, bg, 3200),
          cell(slot.subject?.durationMinutes ? `${slot.subject.durationMinutes}'` : "—", false, bg, 600),
          cell(slot.notes || "", false, bg, 1000),
        ],
      });
    });

    const table = new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            text: schoolName,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: schoolName, bold: true, size: 28, font: "Arial" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Πρόγραμμα Εξετάσεων", size: 20, font: "Arial", color: "444444" })],
          }),
          new Paragraph({ text: "" }),
          table,
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "programma_exetaseon.docx";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function exportFullCSV() {
    const headers = ["Ημερομηνία", "Ημέρα", "Βάρδια", "Μάθημα", "Τάξη", "Τμήμα", "Εισηγητής", "Επιτηρητές", "Διάρκεια (λεπτά)", "Σημειώσεις"];
    const rows = [...slots].sort((a, b) => a.date.localeCompare(b.date)).map(slot => {
      const dt = new Date(slot.date);
      return [slot.date, DAY_NAMES_FULL[dt.getDay()], slot.shift?.name || "", slot.subject?.name || "", slot.class?.grade || "", slot.class?.department || "",
        slot.presenter ? `${slot.presenter.lastName} ${slot.presenter.firstName}` : "",
        (slot.supervisors || []).map(t => `${t.lastName} ${t.firstName}`).join(" / "),
        String(slot.subject?.durationMinutes || ""), slot.notes || ""];
    });
    downloadCSV("programma_exetaseon.csv", [headers, ...rows]);
  }

  function exportTeacherCSV() {
    const headers = ["Εκπαιδευτικός", "Ειδικότητα", "Ρόλος", "Ημερομηνία", "Ημέρα", "Βάρδια", "Μάθημα", "Τάξη"];
    const rows: string[][] = [];
    for (const slot of [...slots].sort((a, b) => a.date.localeCompare(b.date))) {
      const dt = new Date(slot.date);
      const day = DAY_NAMES_FULL[dt.getDay()];
      const cls = [slot.class?.grade, slot.class?.department].filter(Boolean).join(" ");
      if (slot.presenter) rows.push([`${slot.presenter.lastName} ${slot.presenter.firstName}`, slot.presenter.specialty || "", "Εισηγητής", slot.date, day, slot.shift?.name || "", slot.subject?.name || "", cls]);
      for (const sup of slot.supervisors || []) rows.push([`${sup.lastName} ${sup.firstName}`, sup.specialty || "", "Επιτηρητής", slot.date, day, slot.shift?.name || "", slot.subject?.name || "", cls]);
    }
    downloadCSV("programma_ekpaideutikon.csv", [headers, ...rows]);
  }

  if (schedule.isLoading) return <div className="p-8 text-gray-400">Φόρτωση...</div>;

  if (slots.length === 0) {
    return (
      <div className="p-8 text-center">
        <Calendar className="mx-auto mb-4 text-gray-300" size={48} />
        <p className="text-gray-500 text-lg">Δεν υπάρχει πρόγραμμα για εξαγωγή.</p>
        <p className="text-gray-400 text-sm mt-1">Δημιουργήστε πρώτα το πρόγραμμα εξετάσεων.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Screen ── */}
      <div className="no-print">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--text)" }}>Εξαγωγές</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Εκτύπωση & λήψη προγράμματος</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { val: slots.length, label: "Εξετάσεις", color: "blue" },
            { val: sortedDates.length, label: "Ημέρες", color: "green" },
            { val: new Set(slots.map(s => s.class?.grade).filter(Boolean)).size, label: "Τάξεις", color: "purple" },
          ].map(({ val, label, color }) => (
            <div key={label} className={`rounded-xl p-4 text-center bg-${color}-50`}>
              <div className={`text-3xl font-bold text-${color}-700`}>{val}</div>
              <div className={`text-sm text-${color}-600 mt-1`}>{label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-5 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Εξαγωγή</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={triggerPrint} loading={isPrinting}>
              <Printer size={14} /> Εκτύπωση / PDF
            </Button>
            <Button variant="secondary" onClick={exportExcel}>
              <Sheet size={14} /> Excel (.xlsx)
            </Button>
            <Button variant="secondary" onClick={exportWord}>
              <FileText size={14} /> Word (.docx)
            </Button>
            <Button variant="secondary" onClick={exportFullCSV}>
              <FileSpreadsheet size={14} /> CSV Πλήρες
            </Button>
            <Button variant="secondary" onClick={exportTeacherCSV}>
              <FileDown size={14} /> CSV ανά Εκπαιδευτικό
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Η εκτύπωση γίνεται σε οριζόντιο προσανατολισμό (landscape). Στο print dialog επιλέξτε "Fit to page".
          </p>
        </div>

        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Προεπισκόπηση</h2>
          <div style={{ overflowX: "auto" }}>
            <PrintTable slots={slots} schoolName={schoolName} />
          </div>
        </div>
      </div>

      {/* ── Print only ── */}
      {isPrinting && (
        <div className="print-only">
          <PrintTable slots={slots} schoolName={schoolName} />
        </div>
      )}
    </div>
  );
}
