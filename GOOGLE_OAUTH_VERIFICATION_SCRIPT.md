# Google OAuth Verification — Demo Video Script & Scope Justifications

Grounded in the actual code (`backend/src/config/youtube.config.js` `YOUTUBE_SCOPES`, and the
frontend routes in `frontend/src/App.jsx`) as of 2026-08-14. Every scope below is mapped to a real
page and a real API call in this codebase — nothing generic/boilerplate.

## 0. Before you hit record

- **Use a Google account that hasn't already granted Vezrin access.** Already-approved accounts
  skip straight past the full scope-list consent screen, which is the single most important shot
  in the video. If you need to reuse an account, revoke it first at
  https://myaccount.google.com/permissions, then reconnect on camera.
- Note: a fresh test account granting access still counts toward the 100-user unverified-app cap.
  Check the current count in Cloud Console → OAuth consent screen → Overview before burning a slot
  (this is still an open item — see §5).
- **Log into Vezrin itself with a disposable/test account**, not a personal or admin login — don't
  type real credentials on a video that will sit on YouTube (even unlisted).
- Connect a channel that actually has some videos/comments/analytics history — empty states look
  broken to a reviewer.
- Recorder: OBS Studio (free) or Windows' built-in Xbox Game Bar (`Win+G`) — no paid tool needed.
  1080p, system audio + mic narration.
- Don't linger on the Google password field on camera — stay logged in beforehand, or trim that
  second out in a quick edit.
- Target length: ~4-5 minutes. Google wants clarity, not padding.

## 1. Shot-by-shot script

Narration is written in English deliberately — Google's reviewers need it in English (captions are
fine if you'd rather dub afterward than talk live).

**Scene 0 — Intro (0:00–0:20)**
*Show: Vezrin login → Dashboard shell.*
> "Hi — this is a walkthrough of Vezrin, a YouTube channel management and analytics platform for
> creators. I'll show how Vezrin uses each Google permission it requests, one at a time."

**Scene 1 — Consent screen (0:20–0:50)**
*Navigate to `/channels` → click "Connect YouTube Channel."*
> "To link a creator's channel, Vezrin sends them through Google's OAuth consent screen — this is
> exactly what the user sees."
*Let the account picker and full scope list render on camera before clicking Allow.*
> "They review and approve access, Google redirects back, and the channel shows as connected."

**Scene 2 — `youtube.readonly` (0:50–1:20)**
*Navigate to `/dashboard`.*
> "The `youtube.readonly` scope powers the Dashboard — channel profile picture, name, subscriber
> count, and recent videos, pulled straight from YouTube so creators see their status the moment
> they log in."

**Scene 3 — `yt-analytics.readonly` + `yt-analytics-monetary.readonly` (1:20–2:00)**
*Navigate to `/analytics`, scroll to the revenue card, then `/heatmap`.*
> "`yt-analytics.readonly` drives the Analytics page — watch time, subscriber growth, click-through
> rate, per-video performance. For monetized channels, `yt-analytics-monetary.readonly` adds
> estimated revenue right here; if a channel isn't monetized, Vezrin just hides this card instead
> of showing an error. The same analytics scope also powers this audience-retention heatmap."

**Scene 4 — `youtube.upload` (2:00–2:40)**
*Navigate to `/videos/upload`, pick a file, fill title/description, click Publish.*
> "`youtube.upload` lets creators publish directly from Vezrin without opening YouTube Studio. Once
> it's live, it shows up here in Vezrin's video list too."

**Scene 5 — broad `youtube` scope (2:40–3:20)**
*Navigate to `/videos`, open a video: edit title/description, set a custom thumbnail, delete a
disposable test video.*
> "The broader `youtube` scope covers three write actions `readonly` and `upload` don't reach:
> editing an existing video's title and description, setting a custom thumbnail, and deleting a
> video. We confirmed all three return a 403 without this specific scope, which is why it's
> requested alongside the narrower ones rather than instead of them."

**Scene 6 — `youtube.force-ssl` (3:20–4:00)**
*Navigate to `/comments`, reply to a real comment, show it land on the actual YouTube thread.*
> "`youtube.force-ssl` powers the Comments Inbox — it pulls comment threads across the creator's
> videos into one place and lets them reply without leaving Vezrin. YouTube's API requires this
> specific scope for comment reads and replies; `youtube.readonly` alone 403s on these endpoints."

**Scene 7 — `userinfo.email` / `userinfo.profile` (4:00–4:20)**
*Navigate to `/settings`.*
> "Finally, the basic profile scopes are used only to show which Google account is linked — name,
> email, and photo, shown here in Settings. They're not used to access any YouTube data."

**Scene 8 — Close (4:20–4:40)**
*Show footer with Privacy Policy / Terms links.*
> "That's every scope Vezrin requests, each tied to a specific feature. Our Privacy Policy and
> Terms, linked here and on the consent screen, cover how this data is stored and retained. Thanks
> for reviewing."

## 2. Scope justification text (paste into the verification form)

**`.../auth/youtube.readonly`**
> Used to display the connected creator's channel profile (name, profile picture, subscriber
> count) and video list on Vezrin's Dashboard and Videos page, so creators see their channel's
> current status without leaving Vezrin.

**`.../auth/youtube.upload`**
> Used on Vezrin's Upload page to let creators publish new videos to their own YouTube channel
> directly from Vezrin, without separately opening YouTube Studio.

**`.../auth/youtube`**
> Used for three write operations not covered by `youtube.readonly` or `youtube.upload`: updating
> an existing video's title/description/metadata, deleting a video, and setting a custom video
> thumbnail, all from Vezrin's Videos page. `videos.update`, `videos.delete`, and `thumbnails.set`
> return 403 errors under the narrower scopes alone, which is why this broader scope is requested
> in addition to them.

**`.../auth/youtube.force-ssl`**
> Used to power Vezrin's Comments Inbox, which lists comment threads across the creator's videos
> (`commentThreads.list`) and lets the creator reply from within Vezrin (`comments.insert`).
> YouTube's API requires this specific scope for these endpoints — `youtube.readonly` alone returns
> 403 Insufficient Permission.

**`.../auth/yt-analytics.readonly`**
> Used to power Vezrin's Analytics and Heatmap pages — watch time, subscriber trends,
> click-through rate, and audience-retention data pulled from the YouTube Analytics API for the
> creator's own channel.

**`.../auth/yt-analytics-monetary.readonly`**
> Used to display estimated revenue on the Analytics page for creators whose channels are
> monetized. If a channel isn't monetized, or the API declines to return revenue data, Vezrin
> hides this section instead of showing an error.

**`.../auth/userinfo.email`**
> Used only to identify and display which Google account a creator has connected to Vezrin (shown
> as an email address in Settings). Not used to access YouTube data.

**`.../auth/userinfo.profile`**
> Used only to display the connected Google account's name and profile photo in Vezrin's Settings
> page, so the creator can confirm which account is linked. Not used to access YouTube data.

## 3. After recording

1. Upload the video to YouTube as **Unlisted** (not private, not public).
2. Paste that link into the Verification Center's demo video field.
3. Paste the §2 text into each scope's justification box.

## 4. Still open (not part of this script)

1. Re-check the OAuth user count against the 100-user cap — Cloud Console → OAuth consent screen →
   Overview. Console-only, no API access to check this from code.
2. Add `vezrin.com` under Authorized domains in the same Cloud Console screen.
3. Click **Submit for review** once 1-2 and this video/text are in place.
