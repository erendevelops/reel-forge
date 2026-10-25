# QA

## The app checks these automatically (don't do them yourself)

Format and frame count, exact duration (container, video and audio), BT.709 TV range, loudness (−14 LUFS,
true peak ≤ −1.5 dBTP), and footage colour against the source. A final render that fails any of these is marked failed.

## The one check you do

After a draft of your version exists (the job log says `9:16 done`, and the file is
`versions/v<n>/render/draft-<ratio>.mp4`), when you are asked to revise or verify:

1. `rf sheet versions/v<n>/render/draft-9x16.mp4 analysis/draft-v<n>.jpg --every 0.5`
2. Read the sheet. Check every card, caption and layout switch is where your plan says, nothing covers a face, and no text is cut off.
3. Fix what's wrong in `plan.json` and `rf save --parent <n>` with a request line naming the fix.
