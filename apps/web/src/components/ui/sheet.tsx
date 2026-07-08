"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHEET_TRANSITION_MS = 250;
const SHEET_DISMISS_DRAG_PX = 72;
const SHEET_MOBILE_MEDIA = "(max-width: 39.999rem)";

function isMobileSheetViewport() {
  return window.matchMedia(SHEET_MOBILE_MEDIA).matches;
}

type SheetContextValue = {
  requestClose: () => void;
  dismissible: boolean;
  dragOffset: number;
  isDragging: boolean;
  onDragHandlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragHandlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragHandlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragHandlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet subcomponents must be used within Sheet");
  }
  return context;
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Allow backdrop tap, escape, and swipe-to-dismiss (default true). */
  dismissible?: boolean;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  children,
  dismissible = true,
  className,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">("closed");
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const closeRequestedRef = useRef(false);

  const requestClose = useCallback(() => {
    if (!dismissible || closeRequestedRef.current) {
      return;
    }
    closeRequestedRef.current = true;
    onClose();
  }, [dismissible, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRequestedRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      const frame = window.requestAnimationFrame(() => {
        setState("open");
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const frame = window.requestAnimationFrame(() => {
      setState("closed");
      setDragOffset(0);
      isDraggingRef.current = false;
      setIsDragging(false);
    });

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = reducedMotion ? 0 : SHEET_TRANSITION_MS;
    const timer = window.setTimeout(() => {
      if (dialog.open) {
        dialog.close();
      }
      setMounted(false);
    }, delay);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open, mounted]);

  function resetDrag() {
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }

  function onDragHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dismissible || !isMobileSheetViewport()) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartYRef.current = event.clientY;
    dragOffsetRef.current = 0;
    isDraggingRef.current = true;
    setIsDragging(true);
  }

  function onDragHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) {
      return;
    }
    const offset = Math.max(0, event.clientY - dragStartYRef.current);
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  }

  function finishDrag() {
    if (!isDraggingRef.current) {
      return;
    }
    if (dragOffsetRef.current >= SHEET_DISMISS_DRAG_PX) {
      requestClose();
    } else {
      resetDrag();
    }
  }

  function onDragHandlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  }

  function onDragHandlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetDrag();
  }

  if (!mounted) {
    return null;
  }

  const panelStyle: CSSProperties | undefined =
    dragOffset > 0
      ? {
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : undefined,
        }
      : undefined;

  return (
    <SheetContext.Provider
      value={{
        requestClose,
        dismissible,
        dragOffset,
        isDragging,
        onDragHandlePointerDown,
        onDragHandlePointerMove,
        onDragHandlePointerUp,
        onDragHandlePointerCancel,
      }}
    >
      <dialog
        ref={dialogRef}
        className={cn(
          "mogu-sheet-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0",
          state === "open" && "mogu-sheet-dialog-open",
          dragOffset > 0 && "mogu-sheet-dialog-dragging",
        )}
        style={
          dragOffset > 0
            ? ({
                "--sheet-drag-offset": `${dragOffset}px`,
              } as CSSProperties)
            : undefined
        }
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClose={() => {
          if (!open) {
            setMounted(false);
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            requestClose();
          }
        }}
      >
        <div
          className={cn(
            "mogu-sheet-panel flex flex-col overflow-hidden border border-border bg-mogu-surface-elevated shadow-lg",
            "fixed inset-x-0 bottom-0 top-auto max-h-[min(90dvh,720px)] w-full rounded-t-2xl",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85dvh,720px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            state === "open" ? "mogu-sheet-panel-open" : "mogu-sheet-panel-closed",
            className,
          )}
          data-state={state}
          style={panelStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </dialog>
    </SheetContext.Provider>
  );
}

export function SheetGrabber({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-1 w-9 shrink-0 rounded-full bg-muted", className)}
      aria-hidden
    />
  );
}

type SheetDragHandleProps = {
  children: ReactNode;
  className?: string;
};

/** Grabber/header zone that tracks downward drag to dismiss (#127). */
export function SheetDragHandle({ children, className }: SheetDragHandleProps) {
  const {
    dismissible,
    onDragHandlePointerDown,
    onDragHandlePointerMove,
    onDragHandlePointerUp,
    onDragHandlePointerCancel,
  } = useSheetContext();

  return (
    <div
      className={cn("shrink-0 touch-none", className)}
      onPointerDown={dismissible ? onDragHandlePointerDown : undefined}
      onPointerMove={dismissible ? onDragHandlePointerMove : undefined}
      onPointerUp={dismissible ? onDragHandlePointerUp : undefined}
      onPointerCancel={dismissible ? onDragHandlePointerCancel : undefined}
    >
      {children}
    </div>
  );
}

type SheetHeaderProps = {
  children: ReactNode;
  className?: string;
  showClose?: boolean;
};

export function SheetHeader({
  children,
  className,
  showClose = true,
}: SheetHeaderProps) {
  const { requestClose } = useSheetContext();

  return (
    <div className="shrink-0">
      <SheetDragHandle className="flex justify-center px-mogu-screen-x pt-2">
        <SheetGrabber />
      </SheetDragHandle>
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-mogu-screen-x py-3",
          className,
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {showClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="閉じる"
            onClick={requestClose}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-mogu-screen-x py-4", className)}
    >
      {children}
    </div>
  );
}

export function SheetFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-t border-border px-mogu-screen-x py-3", className)}>
      {children}
    </div>
  );
}
