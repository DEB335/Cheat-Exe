import { cn } from "@/lib/utils";

/**
 * Two header treatments exist in the original markup: the roomy
 * `.data-table` styling used by the key/reseller tables, and a denser
 * inline-styled variant used by the monitoring tables.
 */
export function DataTable({
  columns,
  dense = false,
  children,
  className,
}: {
  columns: string[];
  dense?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className={cn("mt-4 w-full border-collapse text-left", className)}>
        <thead>
          <tr className={dense ? "border-b border-white/5" : undefined}>
            {columns.map((column) => (
              <th
                key={column}
                className={cn(
                  dense
                    ? "p-3 text-[12px] font-semibold text-[#64748b]"
                    : "border-b border-line px-5 py-4 text-[11px] font-extrabold tracking-[1.5px] text-muted uppercase",
                  "whitespace-nowrap",
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("border-b border-white/5 [&>td]:transition-colors hover:[&>td]:bg-white/1", className)}>
      {children}
    </tr>
  );
}

export function Cell({
  dense = false,
  className,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { dense?: boolean }) {
  return (
    <td
      {...rest}
      className={cn(
        dense ? "p-3 text-[13px]" : "px-5 py-[18px] text-[13px] font-[550]",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-5 text-center text-[13px] text-[#64748b]">
        {children}
      </td>
    </tr>
  );
}
