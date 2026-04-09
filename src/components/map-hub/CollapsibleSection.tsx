import type { ReactNode } from "react";
import { SidebarSection } from "./SidebarSection";

/** Accordion row — composes {@link SidebarSection} with `collapsible`. */
export function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  variant = "default",
  className = "",
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  variant?: "default" | "accent";
  className?: string;
  children: ReactNode;
}) {
  return (
    <SidebarSection
      collapsible
      title={title}
      summary={summary}
      variant={variant}
      className={className}
      open={open}
      onToggle={onToggle}
    >
      {children}
    </SidebarSection>
  );
}
