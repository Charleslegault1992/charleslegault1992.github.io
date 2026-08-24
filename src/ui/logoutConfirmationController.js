export const createLogoutConfirmationController = ({
  overlay,
  cancelButton,
  confirmButton,
  onConfirm,
  onOpen,
}) => {
  let previousFocus = null;
  let isBound = false;

  const isOpen = () => overlay?.hidden === false;

  const close = ({ restoreFocus = true } = {}) => {
    if (!overlay || !isOpen()) {
      return;
    }
    overlay.hidden = true;
    if (restoreFocus && previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
    previousFocus = null;
  };

  const open = () => {
    if (!overlay || isOpen()) {
      return;
    }
    previousFocus = document.activeElement;
    onOpen?.();
    overlay.hidden = false;
    cancelButton?.focus();
  };

  const handleKeyDown = (event) => {
    if (!isOpen()) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !cancelButton || !confirmButton) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const nextFocus = event.shiftKey
      ? document.activeElement === cancelButton
        ? confirmButton
        : cancelButton
      : document.activeElement === confirmButton
        ? cancelButton
        : confirmButton;
    event.preventDefault();
    event.stopPropagation();
    nextFocus.focus();
  };

  const bind = () => {
    if (isBound || !overlay) {
      return;
    }
    isBound = true;
    overlay.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.target === overlay) {
        close();
      }
    });
    overlay.addEventListener("click", (event) => event.stopPropagation());
    cancelButton?.addEventListener("click", () => close());
    confirmButton?.addEventListener("click", () => {
      if (onConfirm?.() !== false) {
        close({ restoreFocus: false });
      }
    });
    document.addEventListener("keydown", handleKeyDown, true);
  };

  return Object.freeze({ bind, close, isOpen, open });
};
