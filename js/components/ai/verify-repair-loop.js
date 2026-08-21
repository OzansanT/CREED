export async function runVerifyRepairLoop({
  edit,
  verify,
  repair,
  maxAttempts = 3,
  context = {}
} = {}) {
  if (typeof verify !== "function") throw new TypeError("Verify/repair loop requires verify().");
  const attempts = Math.max(1, Math.min(10, Math.trunc(Number(maxAttempts) || 3)));
  const history = [];
  let lastVerification = null;

  if (typeof edit === "function") {
    const editResult = await edit({ context, attempt: 0 });
    history.push({ phase: "edit", attempt: 0, result: editResult });
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastVerification = await verify({ context, attempt, history: [...history] });
    const passed = lastVerification === true || lastVerification?.passed === true || lastVerification?.ok === true;
    history.push({ phase: "verify", attempt, result: lastVerification, passed });
    if (passed) return Object.freeze({ passed: true, attempts: attempt, verification: lastVerification, history });
    if (attempt >= attempts || typeof repair !== "function") break;
    const repairResult = await repair({ context, attempt, verification: lastVerification, history: [...history] });
    history.push({ phase: "repair", attempt, result: repairResult });
  }

  return Object.freeze({ passed: false, attempts, verification: lastVerification, history });
}
