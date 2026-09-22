/** Return whether a token owner still belongs to the token's project. */
export function isActiveCalendarTokenOwner(
  projectMembers: unknown,
  tokenUserId: unknown,
): boolean {
  return Array.isArray(projectMembers) &&
    typeof tokenUserId === 'string' &&
    projectMembers.includes(tokenUserId);
}
