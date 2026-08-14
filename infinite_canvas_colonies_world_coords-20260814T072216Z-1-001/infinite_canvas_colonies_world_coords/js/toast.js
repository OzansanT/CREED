let toastTimer = null;
export function showToast(toastElement, message) { toastElement.textContent = message; toastElement.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove("show"), 1400); }
