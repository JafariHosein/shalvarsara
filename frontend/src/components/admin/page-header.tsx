import type { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Actions rendered at the inline end of the header (buttons, filters). */
  children?: React.ReactNode;
}

/** Consistent title block for every screen of the management panel. */
export function AdminPageHeader({ title, description, icon: Icon, children }: AdminPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
          {Icon ? <Icon className="size-5 shrink-0 text-primary sm:size-6" /> : null}
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
