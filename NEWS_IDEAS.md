# News Improvements Ideas

## Editorial workflow

- Add article states: `DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `ARCHIVED`.
- Require editor approval for high-impact categories (crime, public safety, warrants).
- Add scheduled publishing with timezone-aware publish windows.
- Add post-publication correction flow with visible changelog.

## Case and dispatch integration

- Allow linking an article to one or more `caseId` values.
- Add "press-safe summary" generator from case timeline.
- Add dispatch bulletin templates for traffic and weather incidents.
- Add auto-redaction for sensitive fields before publish.

## Media pipeline

- Support provider-based media attachments (`url` or `item` source).
- Add EXIF stripping and metadata sanitization on upload.
- Add gallery ordering, cover image, and caption slots.
- Add media license/source attribution fields.

## Audience and distribution

- Add channel targeting (`citizens`, `police`, `ems`, `all`).
- Add priority tags (`breaking`, `advisory`, `community`) for feed sorting.
- Add optional push notifications for breaking alerts.
- Add map-linked alerts with clickable waypoints.

## Moderation and quality

- Add forbidden terms and legal-risk keyword checks.
- Add confidence score and fact-check checklist before approval.
- Add duplicate headline detection to reduce spam.
- Add audit trail for all editorial actions.

## Metrics and insights

- Track views, open rate, read time, and engagement reactions.
- Track which channels and times perform best.
- Add topic trend dashboard for newsroom planning.
- Add "public impact" analytics tied to dispatch incident closure.
