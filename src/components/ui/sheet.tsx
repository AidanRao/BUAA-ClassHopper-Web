import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
export function Sheet({
  open,
  onOpenChange,
  title,
  titleAside,
  className,
  closeLabel = "关闭日期选择",
  onCloseAutoFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleAside?: ReactNode;
  className?: string;
  closeLabel?: string;
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"];
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={cn("sheet-content", className)}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="sheet-heading flex items-start justify-between gap-3">
            <div className={cn("min-w-0 flex-1", titleAside && "detail-heading")}>
              <Dialog.Title className="min-w-0 break-words text-lg font-semibold leading-7">
                {title}
              </Dialog.Title>
              {titleAside}
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label={closeLabel} data-analytics-id="close-sheet" className="-mr-2 -mt-2 shrink-0">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
