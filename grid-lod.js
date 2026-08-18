import { BASE_GRID, GRID_BREAKPOINTS, GRID_ORDERS } from "./config.js";
export function getGridOrder(zoom) { if (zoom >= GRID_BREAKPOINTS.ORDER_1_MIN) return 1; if (zoom >= GRID_BREAKPOINTS.ORDER_2_MIN) return 2; if (zoom >= GRID_BREAKPOINTS.ORDER_4_MIN) return 4; return 8; }
export function updateGridLOD(elements, state) {
  const activeOrder = getGridOrder(state.zoom);
  for (const order of GRID_ORDERS) {
    const layer = elements.grids[order];
    const screenGap = BASE_GRID * order * state.zoom;
    layer.style.backgroundSize = `${screenGap}px ${screenGap}px`;
    layer.style.backgroundPosition = `${state.x}px ${state.y}px`;
    layer.classList.toggle("is-active", order === activeOrder);
  }
  elements.lodBadge.textContent = `GRID ${activeOrder}×`;
  elements.orderStat.textContent = `${activeOrder}×`;
  for (const row of elements.lodRows) row.classList.toggle("is-active", Number(row.dataset.order) === activeOrder);
  return activeOrder;
}
