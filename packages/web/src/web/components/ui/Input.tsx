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
