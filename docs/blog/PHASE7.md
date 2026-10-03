# PHASE 7 — AI MATES

Branch: feature/blog-media-platform. No production migration, main merge, or Phase 8 work.

## Assets and model
Verified public/anime in latest main and the feature branch: ichimaru 6 PNG poses, hatsukoro 5, kiimoko 5. All 16 image files are in characterAssets; test.txt files are not poses. Existing pose IDs and filenames are preserved. No unverified expression meanings were added.

AI MATE registry entries declare their owner and data-check role. Scene turns continue to persist character / pose / text / alignment and UUID only; collapse state remains UI state. AI MATES do not become article authors or final predictors.

## Editor and reader
Speaker choices group the three humans and three AI MATES. Mate selection explains the corresponding human partner and research role. Pose thumbnails, text, alignment, fold, clone, arrow ordering and immediate public-renderer preview use the same scene controls as humans.

Reader portraits are smaller than humans; green/pink/gold tints follow the partner. DATA CHECK badge and partner role identify supporting speech. Consecutive mate speech uses even smaller portraits and compact spacing.

## Preview
/blog/preview/dialogue-editor uses three memory-only paired scenes with no race values, PVs or published posts. Each mate has two consecutive turns to verify compact rendering; humans retain the final explanation. Production routes return 404 for fixtures; fixtures are noindex and excluded from DB, public list and Sitemap.

## Checks
node --test tests/blog/aiMates.test.mjs: 3 tests pass, covering all mate pose IDs, role mapping, document validation, alignment, clones, ordering, note export and consecutive-turn compaction.
Repository directory check: all 16 real images registered, no extra image filename inferred.

Changed files: characterAssets.mjs, DialogueSceneEditor.js, dialogueScene.module.css, ArticleBlocks.js, article.module.css, DialoguePlayground.js, aiMates.test.mjs and this document.
