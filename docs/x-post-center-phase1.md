# BoatStrikers X Post Center — Phase 1

## Goal
Create a safe, review-first X posting workflow for four accounts: BoatStrikers, Ichika, Hatsune, and Kiina.

## Scope
- New admin route: `/admin/x-posts`
- Account selector: BoatStrikers / Ichika / Hatsune / Kiina
- Categories: prediction, result, news, DATA LAB, character chat, beginner lesson, announcement
- Statuses: draft, review, ready, posted
- Scheduled-at field (Asia/Tokyo)
- Editable post body, copy action, mark-as-posted action
- Daily counters by account and status

## Safety / data rules
- Phase 1 does not publish to X automatically.
- Race names, race numbers, numerical values, predictions, and results must come from confirmed DB data.
- TRINITY prediction logic and snapshot-writing code are out of scope.
- Social posting consumes only data already approved for publication.
- Character accounts must not simply duplicate official account text.

## Account roles
- BoatStrikers: official news, highlights, consolidated predictions/results, DATA LAB
- Ichika: inside-lane / boat 1 focus, interpretation and education
- Hatsune: women’s races, racers, interpretation and education
- Kiina: longshots / boat 5 focus, interpretation and entertainment

## Initial operating target
- BoatStrikers: up to ~6 planned posts/day
- Each character: up to ~2 planned posts/day

## Deferred to Phase 2
- X API credentials and direct posting
- Scheduled direct publishing
- Analytics ingestion from X
- Fully automated posting
