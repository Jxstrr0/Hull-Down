// Anything that plays on its own (a trial run, a battle) can be held still
// from elsewhere: the page menu holds everything while it is open.

const holders = new Set<() => void>()

/** Ask to be held when the menu opens. Call the returned function to stop asking. */
export function onHold(hold: () => void): () => void {
  holders.add(hold)
  return () => {
    holders.delete(hold)
  }
}

/** Hold everything that is playing. */
export function holdAll(): void {
  for (const hold of [...holders]) hold()
}
