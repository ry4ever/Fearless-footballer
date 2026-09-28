# Session content

Everything players read in the app lives here as plain text. Audio lives in
Cloudflare R2, not in git.

```
content/
  sessions/<slug>/
    session.json      title, category, mentor, status, which MP3 is which version
    description.md    what players read before starting (Markdown)
  programmes/<slug>.json   a named sequence of sessions
```

## Editing a description

Open `sessions/<slug>/description.md` and edit the text. `## ` starts a
section heading and `- ` starts a bullet point. Descriptions marked
**Draft for Mark to review** were written to fill gaps; delete that line
once Mark has approved or rewritten the text.

## session.json

| Field | Meaning |
|---|---|
| `title`, `category` | Shown in the library. Categories group sessions. |
| `mentor` | The voice: name and title. |
| `status` | `ready` = audio recorded; `coming-soon` = listed but not playable yet. |
| `audio` | For each version (`interactive`, `guidance`, `relaxation`), the MP3 file names with and without music, inside `project_details/Sessions/<audioSourceFolder>/`. |
| `sortOrder` | Position in the library (lowest first). |
| `descriptionStatus` | `final`, or `draft-for-review` while Mark hasn't approved it. |

## Adding a new session

1. Put the six MP3s in `project_details/Sessions/<folder>/`.
2. Create `sessions/<slug>/session.json` (copy an existing one) and
   `description.md`.
3. Upload the audio (see the upload script) and commit the content files.

## Re-importing the catalog sheet

`python scripts/importCatalogCsv.py "<path to the exported CSV>"` refreshes
descriptions and categories from the FootballMindGym sheet. It keeps the
audio mapping and status already in each `session.json`.
