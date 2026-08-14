function downloadJson(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "creed-component.json";
  document.body.append(link);
  link.click();
  link.remove();
}

export function openGeneratedJsonFile() {
  const payload = {
    app: "CREED",
    component: "JSON File",
    createdAt: new Date().toISOString(),
    data: {}
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");

  if (!opened) downloadJson(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function bindJsonFileButton({ button }) {
  button.addEventListener("pointerdown", event => event.stopPropagation());
  button.addEventListener("click", event => {
    event.stopPropagation();
    openGeneratedJsonFile();
  });
}
