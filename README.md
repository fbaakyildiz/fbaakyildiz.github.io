# Fatih Berker Akyildiz Portfolio

This repository powers the personal GitHub Pages site at:

<https://fbaakyildiz.github.io/>

It is a static, no-build portfolio designed to stay easy to update as new projects are added.

## Structure

```text
.
├── index.html       # Page structure
├── styles.css       # Visual system and responsive layout
├── script.js        # Project loading, filtering, and search
└── projects.json    # Portfolio project data
```

## Add a New Project

Edit `projects.json` and append a new object:

```json
{
  "title": "Project Name",
  "year": "2026",
  "category": "Analytics",
  "summary": "One concise sentence describing the problem, method, and result.",
  "tags": ["Tag 1", "Tag 2"],
  "stack": ["Python", "FastAPI"],
  "accent": ["#102A43", "#2563EB"],
  "links": [
    {
      "label": "GitHub",
      "url": "https://github.com/fbaakyildiz/example"
    }
  ]
}
```

Then commit and push:

```bash
git add .
git commit -m "docs: add new portfolio project"
git push origin main
```

GitHub Pages will publish the update automatically.
