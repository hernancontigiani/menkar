// Questions asked one after another whose answers may arrive out of order (a period's report, a
// day's estimate): each ask returns a check that is true only while no later ask was made, so an
// answer to a question no longer on screen is dropped.
export function latestOnly(): () => () => boolean {
  let asked = 0
  return () => {
    asked += 1
    const mine = asked
    return () => mine === asked
  }
}
