// What a capture shows is a claim: invented names only (projects, sessions, folders, people,
// domains such as example.com), nothing that reads as a real customer, person or repository.
// The seed's structure is code and its text is here, so both locales seed the same rows.
// Claude Code's own chrome in a stand-in terminal (its permission card and choices, "esc to
// interrupt") stays English in every locale: the real CLI is not translated, and the app's state
// reading matches those English words.
export const en = {
  projectTeam: 'Northwind app',
  projectSite: 'Harbor site',
  projectNotes: 'Field notes',
  filesFolder: 'field-notes',

  sessionLead: 'lead',
  sessionReviewer: 'api-review',
  sessionDocs: 'docs-writer',
  sessionSiteBuild: 'site-build',
  sessionNotes: 'notes',
  sessionRelease: 'release-notes',
  sessionSpike: 'search-spike',

  roleReviewer: 'API reviewer',
  skillApiStyle: 'api-style',
  skillOpenapi: 'openapi-lint',

  task1: 'Rename the export menu',
  task2: 'Add CSV export',
  task3: 'Fix the login timeout',
  task4: 'Update the onboarding copy',
  task5: 'Write the release notes',
  task6: 'Try a chart library',

  task2Step1: 'Read the export code',
  task2Step2: 'Write the CSV writer',
  task2Step3: 'Add it to the menu',
  task2Step4: 'Test with large files',
  task2Step5: 'Report',
  task2Note: 'The writer handles quotes and new lines; wiring the menu now',

  task3Step1: 'Reproduce the timeout',
  task3Step2: 'Pick the new limit',
  task3Step3: 'Change and test it',
  task3Step4: 'Report',
  task3Note: 'Reproduced: sessions end after 15 minutes idle',

  task4Step1: 'Read the current screens',
  task4Step2: 'Rewrite the copy',
  task4Step3: 'Report',
  task4Note: 'Ready: three screens rewritten, shorter by a third',

  task1Step1: 'Find every label',
  task1Step2: 'Rename them',
  task1Step3: 'Report',
  task1Note: 'Renamed in the menu and the shortcuts list',

  topic1: 'Date format in the CSV file',
  topic1Context: 'ISO dates sort well; local dates read better in a spreadsheet.',
  topic2: 'Session timeout: 15 or 30 minutes?',
  topic2Context: 'Support asks for 30; security prefers 15 for shared computers.',
  topic3: 'Name of the export button',
  topic3Context: 'Export, Download or Save as?',
  topic3Decision: 'Export',

  promptLead: 'Plan the 2.4 release with the team',
  screenLead1: 'Three tasks are running; task 4 is ready for your review.',
  screenLead2: 'Waiting on your answer to topic 2 before task 3 goes on.',
  promptReviewer: 'Review the new export endpoint',
  screenReviewer1: 'The endpoint streams rows instead of building the file in memory.',
  askReviewer: 'npm run test:api -- export',
  promptWorker2: 'Task 2: add CSV export',
  screenWorker2a: 'Wrote the CSV writer with quoting and new lines.',
  screenWorker2b: 'Adding the entry to the export menu.',
  promptWorker3: 'Task 3: fix the login timeout',
  screenWorker3a: 'Reproduced: a session ends after 15 minutes idle.',
  screenWorker3b: 'Asked the lead which limit to use (topic 2).',
  promptWorker4: 'Task 4: update the onboarding copy',
  screenWorker4a: 'Rewrote the welcome, the first project and the invite screens.',
  screenWorker4b: 'Ready for review.',
  promptDocs: 'Write the getting-started page',
  screenDocs1: 'Drafted the page with three steps and one screenshot each.',
  promptSiteBuild: 'Make the site build twice as fast',
  screenSiteBuild1: 'Image resizing now runs once per file instead of once per page.',
  promptNotes: 'Summarise this week’s interviews',
  screenNotes1: 'Five interviews, two common requests: offline mode and CSV export.',
  promptNew: 'What should we work on?',

  usagePrompt: 'Keep going',
  usageAnswer: 'Done.',

  fileInterviews: 'interviews.md',
  fileInterviewsText:
    '# Interviews, week 46\n\nFive people who use the app every day.\n\n## What they asked for\n\n- **Offline mode**: three of five work on trains.\n- **CSV export**: two of five copy tables by hand.\n\n## Next\n\n1. Share this with the team.\n2. Pick one request for 2.4.\n',
  filePlan: 'release-plan.md',
  filePlanText: '# Release 2.4\n\n- CSV export\n- A longer login timeout\n- New onboarding copy\n',

  'alt:hero-orchestration':
    'Menkar with the Northwind app team: the orchestrator’s terminal on the right, and in the sidebar what is awaiting you, the tasks with their steps and the sessions.',
  'alt:board-default':
    'The Board open under the header: Awaiting you, Queued, In progress, Waiting, To review and Done, one column each, with the tasks as cards.',
  'alt:first-time-card':
    'The card that turns on the orchestration mode for Harbor site: the orchestrator to choose, its folder and how many workers at once.',
} as const
