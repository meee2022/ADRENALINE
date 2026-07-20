import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-[0_1px_2px_rgba(15,21,22,.03),0_10px_24px_-14px_rgba(14,42,74,.12)]">
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm",
        // العمود الأول = المعرّف الأساسي (الاسم غالبًا) → أبرز وأغمق
        "[&_tbody_td:first-child]:font-bold [&_tbody_td:first-child]:text-[#0f1516]",
        className,
      )}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      // هوية موحّدة: رأس بلون سماوي واضح + حد سماوي صريح أسفله
      "bg-gradient-to-b from-[#e6f4fc] to-[#cfe9f7] [&_tr]:border-b-2 [&_tr]:border-[#3CC4F0]",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-100/90 transition-colors hover:bg-[#3CC4F0]/[0.055] data-[state=selected]:bg-[#3CC4F0]/10",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      // ✅ بدل text-left خليه text-start (يتغير تلقائي RTL/LTR)
      // ✅ بدل pr-0 خليه pr-0 و pl-0 حسب الاتجاه باستخدام :dir()
      "h-11 px-3 text-start align-middle text-[11px] font-extrabold uppercase tracking-wider text-[#2f6088] whitespace-nowrap",
      "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      "rtl:[&:has([role=checkbox])]:pr-2 rtl:[&:has([role=checkbox])]:pl-0",
      "ltr:[&:has([role=checkbox])]:pl-2 ltr:[&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      // ✅ خليها text-start عشان الأعمدة تبقى RTL طبيعي
      "px-3 py-2.5 align-middle text-start text-[13px] text-slate-700",
      "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      "rtl:[&:has([role=checkbox])]:pr-2 rtl:[&:has([role=checkbox])]:pl-0",
      "ltr:[&:has([role=checkbox])]:pl-2 ltr:[&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
