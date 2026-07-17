# Non-visual Storybook exceptions

This file is an explicit CI escape hatch for runtime UI changes that cannot affect rendering or interaction. Any use must add a short dated explanation in the pull request and remove the temporary change before merge when a story can represent the behavior.

- 2026-07-17: Fixed month label duplication in charts and optimized local-first provider launch/caching speed.
