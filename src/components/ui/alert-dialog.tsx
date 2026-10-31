import { AlertDialog } from "radix-ui";
import { Button } from "./button";
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  action: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay confirmation-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={pending} data-analytics-id="cancel-confirmation">
                取消
              </Button>
            </AlertDialog.Cancel>
            <Button onClick={onConfirm} disabled={pending} data-analytics-id="confirm-action">
              {pending ? "处理中…" : action}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
