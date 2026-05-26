import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const variants = {
  primary: { background: "var(--accent)", color: "white", border: "none" },
  secondary: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" },
  danger: { background: "#EF4444", color: "white", border: "none" },
  ghost: { background: "transparent", color: "var(--text-secondary)", border: "none" },
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function Button({ variant = "primary", size = "md", loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${props.className || ""}`}
      style={{ ...variants[variant], ...(props.style || {}) }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
