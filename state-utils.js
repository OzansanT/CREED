export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function replaceObjectContents(target, source) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, source);
  return target;
}
