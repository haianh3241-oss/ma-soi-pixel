export function isWolfRole(role) {
  return role === 'werewolf' || role === 'cursed_wolf';
}

export function formatCountdown(phaseEndsAt, nowMs) {
  if (!phaseEndsAt) return 0;
  return Math.max(0, Math.ceil((phaseEndsAt - nowMs) / 1000));
}
