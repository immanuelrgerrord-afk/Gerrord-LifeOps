import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function preventAccidentalDismiss(event: Event) {
  event.preventDefault();
}

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

/** Stable drawer for add/edit forms — resists keyboard, scroll, and outside-click dismissal. */
function FormDrawer({ onOpenChange, ...props }: React.ComponentProps<typeof Drawer>) {
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) onOpenChange?.(true);
    },
    [onOpenChange],
  );

  return (
    <Drawer
      dismissible={false}
      fixed
      handleOnly
      modal
      repositionInputs
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
}
FormDrawer.displayName = "FormDrawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const FormDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, onPointerDownOutside, onInteractOutside, onEscapeKeyDown, onFocusOutside, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[10px] border bg-background",
        className,
      )}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event);
        preventAccidentalDismiss(event);
      }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event);
        preventAccidentalDismiss(event);
      }}
      onFocusOutside={(event) => {
        onFocusOutside?.(event);
        preventAccidentalDismiss(event);
      }}
      onEscapeKeyDown={(event) => {
        onEscapeKeyDown?.(event);
        preventAccidentalDismiss(event);
      }}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
FormDrawerContent.displayName = "FormDrawerContent";

/** Scrollable form fields — keeps the action footer visible when the keyboard is open. */
const FormDrawerBody = ({ className, onFocus, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
    onFocus={(event) => {
      onFocus?.(event);
      const target = event.target;
      if (target instanceof HTMLElement) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    }}
    {...props}
  />
);
FormDrawerBody.displayName = "FormDrawerBody";

/** Primary action area — pinned to the bottom of the sheet above the keyboard. */
const FormDrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2",
      className,
    )}
    {...props}
  />
);
FormDrawerFooter.displayName = "FormDrawerFooter";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid shrink-0 gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  FormDrawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  FormDrawerContent,
  FormDrawerBody,
  FormDrawerFooter,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
