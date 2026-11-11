import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native disclosure keeps all evidence accessible without a long default page. */
export function DetailDisclosure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <details className={cn("group rounded-lg border border-border", className)}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      {label}<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-border p-3">{children}</div>
  </details>;
}
