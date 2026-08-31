const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const toHexByte = (value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

export const hsvToHex = ({ hue, saturation, value }) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = clamp(saturation, 0, 1);
  const normalizedValue = clamp(value, 0, 1);
  const chroma = normalizedValue * normalizedSaturation;
  const hueSection = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSection < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSection < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSection < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const lightnessOffset = normalizedValue - chroma;
  return `#${toHexByte((red + lightnessOffset) * 255)}${toHexByte((green + lightnessOffset) * 255)}${toHexByte((blue + lightnessOffset) * 255)}`;
};

export const hexToHsv = (hexColor) => {
  const normalizedHex = /^#[0-9a-f]{6}$/i.test(hexColor) ? hexColor.slice(1) : "ffffff";
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0 && maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (delta > 0 && maximum === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else if (delta > 0) {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: (hue + 360) % 360,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
};

export const createColorWheelPicker = ({ parentElement, closeLabel }) => {
  const documentObject = parentElement?.ownerDocument;
  if (!documentObject) {
    return null;
  }

  const overlayElement = documentObject.createElement("div");
  overlayElement.classList.add("character-color-picker-overlay");
  overlayElement.hidden = true;
  const pickerElement = documentObject.createElement("section");
  pickerElement.classList.add("character-color-picker");
  const headerElement = documentObject.createElement("div");
  headerElement.classList.add("character-color-picker-header");
  const titleElement = documentObject.createElement("strong");
  const closeButtonElement = documentObject.createElement("button");
  closeButtonElement.classList.add("character-color-picker-close");
  closeButtonElement.type = "button";
  closeButtonElement.textContent = "x";
  closeButtonElement.title = closeLabel;
  closeButtonElement.setAttribute("aria-label", closeLabel);
  const wheelElement = documentObject.createElement("div");
  wheelElement.classList.add("character-color-wheel");
  wheelElement.setAttribute("role", "slider");
  wheelElement.tabIndex = 0;
  const markerElement = documentObject.createElement("span");
  markerElement.classList.add("character-color-wheel-marker");
  wheelElement.appendChild(markerElement);
  const brightnessElement = documentObject.createElement("input");
  brightnessElement.classList.add("character-color-brightness");
  brightnessElement.type = "range";
  brightnessElement.min = "0";
  brightnessElement.max = "100";
  brightnessElement.step = "1";
  headerElement.append(titleElement, closeButtonElement);
  pickerElement.append(headerElement, wheelElement, brightnessElement);
  overlayElement.appendChild(pickerElement);
  parentElement.appendChild(overlayElement);

  let currentHsv = { hue: 0, saturation: 0, value: 1 };
  let onInput = null;
  let pendingColor = null;
  let pendingFrame = null;
  const windowObject = documentObject.defaultView;
  const requestFrame = windowObject?.requestAnimationFrame?.bind(windowObject) ?? ((callback) => setTimeout(callback, 0));
  const cancelFrame = windowObject?.cancelAnimationFrame?.bind(windowObject) ?? clearTimeout;

  const flushPendingColor = () => {
    pendingFrame = null;
    if (pendingColor === null) {
      return;
    }
    const color = pendingColor;
    pendingColor = null;
    onInput?.(color);
  };

  const scheduleColorInput = (color) => {
    pendingColor = color;
    if (pendingFrame === null) {
      pendingFrame = requestFrame(flushPendingColor);
    }
  };

  const refreshPicker = (emitColor) => {
    const angle = ((currentHsv.hue - 90) * Math.PI) / 180;
    const radiusPercent = currentHsv.saturation * 50;
    markerElement.style.left = `${50 + Math.cos(angle) * radiusPercent}%`;
    markerElement.style.top = `${50 + Math.sin(angle) * radiusPercent}%`;
    brightnessElement.value = String(Math.round(currentHsv.value * 100));
    const color = hsvToHex(currentHsv);
    markerElement.style.backgroundColor = color;
    wheelElement.setAttribute("aria-valuetext", color);
    brightnessElement.style.setProperty("--character-picker-color", hsvToHex({ ...currentHsv, value: 1 }));
    if (emitColor) {
      scheduleColorInput(color);
    }
  };

  const updateFromPointer = (event) => {
    const bounds = wheelElement.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const deltaX = event.clientX - (bounds.left + bounds.width / 2);
    const deltaY = event.clientY - (bounds.top + bounds.height / 2);
    currentHsv.hue = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
    currentHsv.saturation = clamp(Math.hypot(deltaX, deltaY) / radius, 0, 1);
    refreshPicker(true);
  };

  wheelElement.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    wheelElement.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  wheelElement.addEventListener("pointermove", (event) => {
    if (wheelElement.hasPointerCapture(event.pointerId)) {
      event.preventDefault();
      updateFromPointer(event);
    }
  });
  wheelElement.addEventListener("pointerup", (event) => {
    if (wheelElement.hasPointerCapture(event.pointerId)) {
      wheelElement.releasePointerCapture(event.pointerId);
    }
  });
  brightnessElement.addEventListener("input", () => {
    currentHsv.value = Number(brightnessElement.value) / 100;
    refreshPicker(true);
  });

  const close = () => {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      flushPendingColor();
    }
    overlayElement.hidden = true;
    onInput = null;
  };
  closeButtonElement.addEventListener("click", close);
  overlayElement.addEventListener("click", (event) => {
    if (event.target === overlayElement) {
      close();
    }
  });

  return {
    open: ({ color, label, onColorInput }) => {
      currentHsv = hexToHsv(color);
      onInput = onColorInput;
      titleElement.textContent = label;
      wheelElement.setAttribute("aria-label", label);
      brightnessElement.setAttribute("aria-label", label);
      overlayElement.hidden = false;
      refreshPicker(false);
    },
    close,
  };
};
