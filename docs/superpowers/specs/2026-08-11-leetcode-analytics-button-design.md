# LeetCode Analytics button (vendor portal)

**Date:** 2026-08-11  
**Status:** Approved  

## Summary

Vendor admins can set a per-vendor LeetCode Analytics URL in Settings. The Vendor Dashboard shows a “LeetCode Analytics” button only when that URL is set; click opens the URL in a new tab.

## Decisions

- Configured by **vendor admin only** (Settings)
- Button **hidden** when URL is empty
- Stored as `Vendor.settings.leetcodeAnalyticsUrl`
- Validate: empty OK; if set, must start with `http://` or `https://`

## Scope

- Backend: Vendor model + `PUT /vendor-admin/vendor` merge + branding payload
- Frontend: Settings field, Dashboard CTA, branding normalize pass-through
- No super-admin UI, no student-facing change
