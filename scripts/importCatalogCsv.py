"""
One-off import of the FootballMindGym catalog sheet into content/sessions/.

For each row it writes content/sessions/<slug>/description.md (Mark's text,
with his section titles as headings and his lists as bullet points) and a
session.json with the metadata. Existing session.json files are updated,
not replaced, so hand edits (audio mapping, status) survive a re-import.

Usage: python scripts/importCatalogCsv.py "<path to csv>"
"""
import csv, json, os, re, sys

HEADINGS = [
    "Who this is for", "What's actually happening", "What this session conditions",
    "What you're conditioning", "How it works", "How to prepare", "Before you start",
    "The science behind this session", "The research behind this session",
    "What we do about it", "The question", "Your Game Blueprint", "Choosing your two",
    "Work either side", "Words that don't work, and why it matters", "Using it in a game",
    "What that produces:", "When to use it:", "What this session conditions:",
    "This isn't only a game day session", "Why this goes further than patterns of play in training",
    "The unfamiliar ground", "The knock-on", "The most important thing about this session",
    "What to expect from it", "Why it works", "The language.", "The conditions.",
]
NORMALISED = {h.lower().rstrip(":.").strip(): h.rstrip(":").rstrip(".") if h.endswith(":") else h.rstrip(".") for h in HEADINGS}

# Rows that match recorded audio: sheet subcategory -> (slug, display title)
AUDIO_ROWS = {
    "Better Final Ball": ("better-final-ball", "Better Final Ball"),
    "Back to your best": ("back-to-your-best", "Back to Your Best"),
    "Finishing Condition Yourself To Become An Ice Cold Finisher": ("ice-cold-finisher", "Ice Cold Finisher"),
    "Play Your Next Game": ("play-your-next-game", "Play Your Next Game"),
    # Same slug as the built-in sample session.
    "Nerves = Performance": ("nerves-equals-performance", "Nerves = Performance"),
}
# "Unshakable" appears twice with identical text; keep one, under Match Day Preparation.
SKIP = {("Game Day", "Unshakable")}
# Placeholder sheet names that aren't player-facing titles.
TITLE_OVERRIDES = {("Resilience", "Session with Music"): "Resilience"}

def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", "and")).strip("-")

def heading_of(line):
    key = line.strip().lower().rstrip(":.").strip()
    return NORMALISED.get(key)

def to_markdown(text):
    lines = [l.replace("\u00a0", " ").rstrip() for l in text.replace("\r\n", "\n").split("\n")]
    # Internal note in the sheet, not player-facing.
    lines = [l for l in lines if "Mark complete on your dashboard" not in l]
    out, block = [], []

    def flush():
        items = [l.strip() for l in block if l.strip()]
        if not items:
            return
        is_list = len(items) > 1
        for item in items:
            h = heading_of(item)
            if h:
                out.append(f"\n## {h}\n")
            elif is_list:
                out.append(f"- {item}")
            else:
                out.append(f"\n{item}\n")
        out.append("")

    for line in lines:
        if line.strip():
            block.append(line)
        else:
            flush(); block = []
    flush()
    md = "\n".join(out)
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    # A single-paragraph reference list still reads best as bullets.
    return md

def main(path):
    root = os.path.join("content", "sessions")
    os.makedirs(root, exist_ok=True)
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        category = row["Category"].strip()
        sub = row["Subcategory"].strip()
        if (category, sub) in SKIP:
            continue
        slug, title = AUDIO_ROWS.get(sub, (slugify(TITLE_OVERRIDES.get((category, sub), sub)), TITLE_OVERRIDES.get((category, sub), sub)))
        folder = os.path.join(root, slug)
        os.makedirs(folder, exist_ok=True)
        meta_path = os.path.join(folder, "session.json")
        meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
        meta.setdefault("slug", slug)
        meta.setdefault("title", title)
        meta["category"] = category
        meta.setdefault("mentor", {"name": "Mark Bowden", "title": "Football Mentor"})
        meta.setdefault("status", "coming-soon")
        meta.setdefault("audio", None)
        description = (row.get("Description") or "").strip()
        meta["hasDescription"] = bool(description)
        if description:
            open(os.path.join(folder, "description.md"), "w", encoding="utf-8", newline="\n").write(to_markdown(description))
        json.dump(meta, open(meta_path, "w", encoding="utf-8", newline="\n"), indent=2, ensure_ascii=False)
        open(meta_path, "a", encoding="utf-8", newline="\n").write("\n")
        print(f"{slug:48s} {category:22s} {'desc' if description else 'NO DESCRIPTION'}")

if __name__ == "__main__":
    main(sys.argv[1])
