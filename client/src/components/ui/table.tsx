import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  // بطاقة جدول مكتملة: حواف مدوّرة + ظل ناعم + رأس غامق يلمس الحواف (بلا إطار مزدوج).
  <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,21,22,.04),0_16px_34px_-18px_rgba(14,42,74,.20)]">
    <div className="w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm",
          // العمود الأول = المعرّف الأساسي (الاسم غالبًا) → أبرز وأغمق
          "[&_tbody_td:first-child]:font-bold [&_tbody_td:first-child]:text-[#0f1516]",
          // تلوين متبادل خفيف للصفوف (zebra) — الصفوف تتنفّس وتبان
          "[&_tbody_tr:nth-child(even)]:bg-[#f7fafc]",
          className,
        )}
        {...props}
      />
    </div>
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
      // رأس غامق صريح بهوية أدرينالين (أزرق عميق) + خط سماوي رفيع كتوقيع + نص أبيض
      "bg-gradient-to-b from-[#137bb0] to-[#0c5f88] [&_tr]:border-b-2 [&_tr]:border-[#3CC4F0]",
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
      "border-b border-slate-100 transition-colors hover:!bg-[#e9f6fd] data-[state=selected]:!bg-[#d6eefb]",
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
      "h-12 px-4 text-start align-middle text-[12.5px] font-bold text-white whitespace-nowrap",
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
      "px-4 py-3.5 align-middle text-start text-[13.5px] text-slate-700 [font-variant-numeric:tabular-nums]",
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
