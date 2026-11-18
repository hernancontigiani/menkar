// Where an orchestrator's worker's tab is when it is not an ordinary one. In the background it is
// not drawn and its process keeps running; the peek is its project's one drawn tab of that kind,
// always the last of the project's tabs.
export type TabPlace = 'background' | 'peek'
