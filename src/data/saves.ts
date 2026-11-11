// Save slots and the backup reminder.
export const SAVES = {
  /** Save slots on one device. */
  slots: 3,
  /** Days after the last backup (or the first save) before the game reminds the player to take one. */
  remindDays: 14,
} as const
