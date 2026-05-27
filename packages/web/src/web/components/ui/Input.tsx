import { useState, useEffect } from "react";

// DateInput: always shows dd/mm/yyyy regardless of OS/browser locale.
// Stores value as ISO string (yyyy-mm-dd) for compatibility with date inputs internally,
// but displays and accepts dd/mm/yyyy from the user.
interface DateInputProps {
  label?: string;
  value: string; // yyyy-mm-dd or ""
  onChange: (e: { target: { value: string } }) => void;
  placeholder?: string;
}
export function DateInput({ label, value, onChange, placeholder = "dd/mm/yyyy" }: DateInputProps) {
  // display is dd/mm/yyyy; value is yyyy-mm-dd
  const toDisplay = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };
  const toISO = (display: string) => {
    const parts = display.replace(/[^0-9]/g, "/").split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y && y.length === 4) return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
    }
    return "";
  };

  const [raw, setRaw] = useState(toDisplay(value));

  useEffect(() => {
    // Sync external value changes (e.g. loaded from DB)
    setRaw(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    // Auto-insert slashes
    v = v.replace(/[^0-9/]/g, "");
    if (v.length === 2 && raw.length === 1) v += "/";
    if (v.length === 5 && raw.length === 4) v += "/";
    if (v.length > 10) return;
    setRaw(v);
    const iso = toISO(v);
    if (iso) onChange({ target: { value: iso } });
    else if (v === "") onChange({ target: { value: "" } });
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        className="px-3 py-2 text-sm rounded-lg border transition-colors outline-none focus:ring-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>}
      <input
        {...props}
        className={`px-3 py-2 text-sm rounded-lg border transition-colors outline-none focus:ring-2 ${props.className || ""}`}
        style={{
          background: "var(--surface)",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          color: "var(--text)",
          ...(props.style || {}),
        }}
      />
      {error && <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export function Select({ label, error, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>}
      <select
        {...props}
        className={`px-3 py-2 text-sm rounded-lg border transition-colors outline-none ${props.className || ""}`}
        style={{
          background: "var(--surface)",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          color: "var(--text)",
          ...(props.style || {}),
        }}
      >
        {children}
      </select>
      {error && <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
