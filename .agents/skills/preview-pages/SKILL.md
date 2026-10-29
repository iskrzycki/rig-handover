---
name: preview-pages
description: Put one rig page up as a public preview on GitHub Pages, upload over it without the lane marker after review, or take it down. Use when a plan ends in "Preview for review" or "Clean up" (ADR 0003).
---

# preview-pages

The preview is one HTML file built by `.github/workflows/preview.yml` (`pnpm preview`) and
deployed as a Pages artifact. It is never committed (ADR 0003). Needs `gh` with the `repo` and
`workflow` scopes. Ask the human before each step that publishes.

## Once per repo

```sh
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

## Put it up (marker on)

```sh
printf '%s' "$LANE_MARKER" | gh secret set LANE_MARKER
gh workflow run preview.yml --ref main
gh run watch <run-id> --exit-status
curl -s https://<owner>.github.io/<repo>/ | grep -o '<span class="marker">[^<]*</span>'
```

Send the link. Leave the preview issue open until the reviewer has looked.

## Upload over it (marker off, after the review)

```sh
gh secret delete LANE_MARKER
gh workflow run preview.yml --ref main
gh api repos/<owner>/<repo>/actions/artifacts --jq '.artifacts[] | "\(.id) \(.workflow_run.id)"'
gh api -X DELETE repos/<owner>/<repo>/actions/artifacts/<id-of-the-run-with-the-marker>
```

Check the link shows "no marker set". Pages caches for up to 10 minutes.

## Take it down

```sh
gh api -X DELETE repos/<owner>/<repo>/pages
```

Locally, `pnpm preview [page] [out]` writes to `var/preview/` (git-ignored); `LANE_MARKER= pnpm preview` saves it without the marker.
