interface BadgeProps {
  children: React.ReactNode;
  variant?: "blue" | "green" | "yellow" | "red" | "gray" | "purple";
}

const variants = {
  blue: { bg: "#DBEAFE", color: "#1D4ED8" },
  green: { bg: "#D1FAE5", color: "#065F46" },
  yellow: { bg: "#FEF3C7", color: "#92400E" },
  red: { bg: "#FEE2E2", color: "#991B1B" },
  gray: { bg: "#F1F5F9", color: "#475569" },
  purple: { bg: "#EDE9FE", color: "#5B21B6" },
};

export function Badge({ children, variant = "blue" }: BadgeProps) {
  const style = variants[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {children}
    </span>
  );
}
