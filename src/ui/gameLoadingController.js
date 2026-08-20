export const createGameLoadingController = ({
  overlay,
  statusElement,
  progressElement,
  retryButton,
  getText,
  onRetry,
}) => {
  const show = () => {
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove("game-loading-failed");
    }
    if (retryButton) {
      retryButton.hidden = true;
    }
  };

  const setStage = (textKey, progress) => {
    show();
    if (statusElement) {
      statusElement.textContent = getText(textKey);
    }
    if (progressElement) {
      const normalizedProgress = Math.max(0, Math.min(Number(progress) || 0, 1));
      progressElement.style.transform = `scaleX(${normalizedProgress})`;
      progressElement.parentElement?.setAttribute("aria-valuenow", String(Math.round(normalizedProgress * 100)));
    }
  };

  const fail = () => {
    show();
    overlay?.classList.add("game-loading-failed");
    if (statusElement) {
      statusElement.textContent = getText("loadingFailed");
    }
    if (retryButton) {
      retryButton.hidden = false;
    }
  };

  const hide = () => {
    if (overlay) {
      overlay.hidden = true;
    }
  };

  retryButton?.addEventListener("click", () => onRetry());

  return Object.freeze({ fail, hide, setStage, show });
};
