# History of `docs/NOT_BUILT_YET.md`

## Menkar's own copy of the transcripts

> Left on 2026-11-10: option B dropped by the human on 2026-11-09, because the retention
> integration (`cleanupPeriodDays`) covers the need.
### Menkar's own copy of the transcripts
Transcript retention (2026-11-10) asks Claude Code to keep its transcripts longer, through
`cleanupPeriodDays` in `~/.claude/settings.json`. The other way, option B, would have Menkar copy a
member session's transcript into its data directory and show the copy in the replay tab after
Claude Code deletes the original. That is a second store of the user's prompts and code, which
would have to be kept, sized and deleted; and the integration already covers whoever turns it on.
**Trigger:** someone who will not touch Claude Code's settings loses a transcript they needed, or
retention through the setting stops working. First question: which sessions get copied (members
only, or everything seen), and when a copy is deleted.
