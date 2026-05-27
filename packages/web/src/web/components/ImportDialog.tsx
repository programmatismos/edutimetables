import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { api, safeJson } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedData {
  teachers: any[];
  classes: any[];
  subjects: any[];
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---- Template generation ----
function downloadTemplate(format: "xlsx" | "csv") {
  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    // Teachers sheet
    const teachersData = [
      ["Επώνυμο", "Όνομα", "Κωδικός Ειδικότητας", "Περιγραφή Ειδικότητας", "Ρόλος", "Τύπος"],
      ["Παπαδόπουλος", "Γιώργος", "ΠΕ02", "Φιλόλογος", "both", "general"],
      ["Νικολάου", "Μαρία", "ΠΕ03", "Μαθηματικός", "supervisor", "general"],
    ];
    const wsTeachers = XLSX.utils.aoa_to_sheet(teachersData);
    wsTeachers["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsTeachers, "Εκπαιδευτικοί");

    // Classes sheet
    const classesData = [
      ["Τάξη", "Τομέας", "Τύπος Σχολείου", "Αριθμός Μαθητών", "Ετικέτα"],
      ["Α", "", "ΓΕΛ", "25", "Α ΓΕΛ"],
      ["Β", "Οικονομίας", "ΕΠΑΛ", "20", "Β Οικονομίας"],
      ["Γ", "Πληροφορικής", "ΕΠΑΛ", "18", "Γ Πληροφορικής"],
    ];
    const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
    wsClasses["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsClasses, "Τμήματα");

    // Subjects sheet
    const subjectsData = [
      ["Μάθημα", "Ετικέτα Τμήματος", "Εισηγητής (Επώνυμο)", "Τύπος", "Διάρκεια (λεπτά)", "Προτεραιότητα (1-10)", "Μπορεί να χωριστεί"],
      ["Νέα Ελληνικά", "Α ΓΕΛ", "Παπαδόπουλος", "general", "120", "1", "false"],
      ["Μαθηματικά", "Β Οικονομίας", "Νικολάου", "general", "120", "2", "false"],
      ["Ειδικότητα", "Γ Πληροφορικής", "", "specialty", "180", "5", "true"],
    ];
    const wsSubjects = XLSX.utils.aoa_to_sheet(subjectsData);
    wsSubjects["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsSubjects, "Μαθήματα");

    XLSX.writeFile(wb, "template_eisagogi.xlsx");
  } else {
    // CSV — export 3 separate CSVs as one zip? No, just teachers for simplicity, or use a combined approach.
    // We'll download teachers CSV only as example, with a note
    const lines = [
      "# Εκπαιδευτικοί",
      "Επώνυμο,Όνομα,Κωδικός Ειδικότητας,Περιγραφή Ειδικότητας,Ρόλος,Τύπος",
      "Παπαδόπουλος,Γιώργος,ΠΕ02,Φιλόλογος,both,general",
      "",
      "# Τμήματα",
      "Τάξη,Τομέας,Τύπος Σχολείου,Αριθμός Μαθητών,Ετικέτα",
      "Α,,ΓΕΛ,25,Α ΓΕΛ",
      "",
      "# Μαθήματα",
      "Μάθημα,Ετικέτα Τμήματος,Εισηγητής (Επώνυμο),Τύπος,Διάρκεια (λεπτά),Προτεραιότητα (1-10),Μπορεί να χωριστεί",
      "Νέα Ελληνικά,Α ΓΕΛ,Παπαδόπουλος,general,120,1,false",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_eisagogi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ---- Parse xlsx/csv to structured data ----
function parseWorkbook(wb: XLSX.WorkBook): ParsedData {
  const result: ParsedData = { teachers: [], classes: [], subjects: [] };

  const sheetAliases: Record<string, keyof ParsedData> = {
    "εκπαιδευτικοί": "teachers",
    "teachers": "teachers",
    "καθηγητές": "teachers",
    "τμήματα": "classes",
    "classes": "classes",
    "τάξεις": "classes",
    "μαθήματα": "subjects",
    "subjects": "subjects",
  };

  const colAliasTeachers: Record<string, string> = {
    "επώνυμο": "lastName", "last name": "lastName", "lastname": "lastName",
    "όνομα": "firstName", "first name": "firstName", "firstname": "firstName",
    "κωδικός ειδικότητας": "specialty", "specialty": "specialty", "ειδικότητα": "specialty",
    "περιγραφή ειδικότητας": "specialtyLabel", "specialty label": "specialtyLabel",
    "ρόλος": "role", "role": "role",
    "τύπος": "educationType", "type": "educationType",
  };
  const colAliasClasses: Record<string, string> = {
    "τάξη": "grade", "grade": "grade",
    "τομέας": "department", "department": "department",
    "τύπος σχολείου": "schoolType", "school type": "schoolType", "schooltype": "schoolType",
    "αριθμός μαθητών": "studentCount", "student count": "studentCount", "studentcount": "studentCount",
    "ετικέτα": "label", "label": "label",
  };
  const colAliasSubjects: Record<string, string> = {
    "μάθημα": "name", "subject": "name", "name": "name",
    "ετικέτα τμήματος": "classLabel", "class label": "classLabel", "τμήμα": "classLabel",
    "εισηγητής (επώνυμο)": "presenterName", "εισηγητής": "presenterName", "presenter": "presenterName",
    "τύπος": "subjectType", "type": "subjectType",
    "διάρκεια (λεπτά)": "durationMinutes", "duration": "durationMinutes", "διάρκεια": "durationMinutes",
    "προτεραιότητα (1-10)": "priority", "priority": "priority", "προτεραιότητα": "priority",
    "μπορεί να χωριστεί": "canSplit", "can split": "canSplit", "cansplit": "canSplit",
  };

  function parseSheet(ws: XLSX.WorkSheet, colAliases: Record<string, string>): any[] {
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    if (rows.length < 2) return [];

    // Find header row (skip comment lines starting with #)
    let headerIdx = 0;
    for (let i = 0; i < rows.length; i++) {
      const first = String(rows[i][0] || "").trim();
      if (first.startsWith("#") || first === "") continue;
      headerIdx = i;
      break;
    }

    const headers = rows[headerIdx].map((h: any) => String(h).trim().toLowerCase());
    const mappedHeaders = headers.map(h => colAliases[h] || null);

    const result: any[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const first = String(row[0] || "").trim();
      if (first === "" || first.startsWith("#")) continue;
      const obj: any = {};
      mappedHeaders.forEach((key, idx) => {
        if (key) obj[key] = String(row[idx] ?? "").trim();
      });
      result.push(obj);
    }
    return result;
  }

  // Single sheet CSV (combined with # headers)
  if (wb.SheetNames.length === 1 && (wb.SheetNames[0] === "Sheet1" || wb.SheetNames[0] === "sheet1")) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    
    let section: keyof ParsedData | null = null;
    let headerRow: string[] = [];
    let mappedHeaders: (string | null)[] = [];

    for (const row of rows) {
      const first = String(row[0] || "").trim();
      if (first.startsWith("# Εκπαιδευτικοί") || first.toLowerCase() === "# teachers") {
        section = "teachers"; headerRow = []; continue;
      }
      if (first.startsWith("# Τμήματα") || first.toLowerCase() === "# classes") {
        section = "classes"; headerRow = []; continue;
      }
      if (first.startsWith("# Μαθήματα") || first.toLowerCase() === "# subjects") {
        section = "subjects"; headerRow = []; continue;
      }
      if (!section || first === "") continue;

      if (headerRow.length === 0) {
        // This is the header row
        const aliases = section === "teachers" ? colAliasTeachers : section === "classes" ? colAliasClasses : colAliasSubjects;
        headerRow = row.map((h: any) => String(h).trim().toLowerCase());
        mappedHeaders = headerRow.map(h => aliases[h] || null);
        continue;
      }

      const obj: any = {};
      mappedHeaders.forEach((key, idx) => {
        if (key) obj[key] = String(row[idx] ?? "").trim();
      });
      result[section].push(obj);
    }
    return result;
  }

  // Multi-sheet Excel
  for (const sheetName of wb.SheetNames) {
    const key = sheetAliases[sheetName.trim().toLowerCase()];
    if (!key) continue;
    const ws = wb.Sheets[sheetName];
    const aliases = key === "teachers" ? colAliasTeachers : key === "classes" ? colAliasClasses : colAliasSubjects;
    result[key] = parseSheet(ws, aliases);
  }

  return result;
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ teachers: number; classes: number; subjects: number } | null>(null);

  function reset() {
    setParsed(null);
    setFileName("");
    setParseError("");
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    setParsed(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const result = parseWorkbook(wb);
        if (result.teachers.length === 0 && result.classes.length === 0 && result.subjects.length === 0) {
          setParseError("Δεν βρέθηκαν δεδομένα. Βεβαιωθείτε ότι χρησιμοποιείτε το σωστό template.");
        } else {
          setParsed(result);
        }
      } catch (err: any) {
        setParseError(`Σφάλμα ανάγνωσης: ${err?.message || String(err)}`);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      const res = await safeJson((api as any).import.$post({ json: parsed }));
      setImportResult({ teachers: res.teachers, classes: res.classes, subjects: res.subjects });
      qc.invalidateQueries();
      setParsed(null);
    } catch (err: any) {
      setParseError(`Σφάλμα εισαγωγής: ${err?.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Εισαγωγή Δεδομένων" open={open} onClose={handleClose}>
      <div className="space-y-4" style={{ minWidth: 340 }}>

        {/* Success state */}
        {importResult && (
          <div className="rounded-lg p-4 space-y-2" style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}>
            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#166534" }}>
              <CheckCircle size={16} /> Εισαγωγή ολοκληρώθηκε
            </div>
            <ul className="text-sm space-y-0.5" style={{ color: "#166534" }}>
              <li>Εκπαιδευτικοί: <strong>{importResult.teachers}</strong></li>
              <li>Τμήματα: <strong>{importResult.classes}</strong></li>
              <li>Μαθήματα: <strong>{importResult.subjects}</strong></li>
            </ul>
            <Button size="sm" variant="secondary" onClick={reset} className="mt-2">Νέα Εισαγωγή</Button>
          </div>
        )}

        {!importResult && (
          <>
            {/* Template download */}
            <div className="rounded-lg p-4" style={{ background: "var(--surface-alt, #F8FAFC)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Βήμα 1 — Κατεβάστε το template</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadTemplate("xlsx")}>
                  <Download size={13} /> Excel (.xlsx)
                </Button>
                <Button size="sm" variant="secondary" onClick={() => downloadTemplate("csv")}>
                  <Download size={13} /> CSV
                </Button>
              </div>
            </div>

            {/* File upload */}
            <div className="rounded-lg p-4" style={{ background: "var(--surface-alt, #F8FAFC)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Βήμα 2 — Ανεβάστε το συμπληρωμένο αρχείο</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv,.xls"
                onChange={handleFile}
                style={{ display: "none" }}
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} type="button">
                  <Upload size={13} /> Επιλογή Αρχείου
                </Button>
              </label>
              {fileName && (
                <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <FileSpreadsheet size={13} /> {fileName}
                </div>
              )}
            </div>

            {/* Error */}
            {parseError && (
              <div className="rounded-lg p-3 flex items-start gap-2 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Preview */}
            {parsed && (
              <div className="rounded-lg p-4 space-y-2" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#1E40AF" }}>Βήμα 3 — Προεπισκόπηση</p>
                <ul className="text-sm space-y-0.5" style={{ color: "#1D4ED8" }}>
                  <li>Εκπαιδευτικοί: <strong>{parsed.teachers.length}</strong></li>
                  <li>Τμήματα: <strong>{parsed.classes.length}</strong></li>
                  <li>Μαθήματα: <strong>{parsed.subjects.length}</strong></li>
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={handleClose}>Ακύρωση</Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={!parsed}
              >
                <Upload size={14} /> Εισαγωγή
              </Button>
            </div>
          </>
        )}

        {importResult && (
          <div className="flex justify-end">
            <Button onClick={handleClose}>Κλείσιμο</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
