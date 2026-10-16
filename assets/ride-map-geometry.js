// Centre the pickup target in the unobscured map, in map-container pixels.
globalThis.VasiPickupMapCenter = function (mapRect, panelRect) {
  const sidePanel = panelRect.width < mapRect.width * 0.7;
  const left = sidePanel ? Math.max(16, panelRect.right - mapRect.left + 20) : 16;
  const right = Math.max(left + 40, mapRect.width - 16);
  const top = Math.min(110, mapRect.height * 0.25);
  const bottom = sidePanel ? mapRect.height - 20
    : Math.max(top + 40, Math.min(mapRect.height - 20, panelRect.top - mapRect.top - 16));
  return { x: Math.min(mapRect.width - 20, (left + right) / 2), y: (top + bottom) / 2 };
};
