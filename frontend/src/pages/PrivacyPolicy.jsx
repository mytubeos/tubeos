import { Link } from 'react-router-dom'

export function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-base-900 text-gray-300 px-5 py-10">
      <div className="max-w-3xl mx-auto space-y-7 leading-relaxed">
        <Link to="/" className="text-brand">
          Vezrin · VibeCore Technologies
        </Link>
        <h1 className="text-3xl text-white font-bold">Privacy Policy</h1>
        <p className="text-sm text-gray-400">Last updated: October 16, 2026</p>
        <p>
          VibeCore Technologies operates Vezrin, a creator workspace for YouTube analytics,
          scheduling and AI tools. Contact hello@vezrin.com for privacy, access, correction,
          deletion or support requests.
        </p>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">Data we process</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Account: name, email, password hash, optional profile photo and bio, preferences and
              plan/usage records.
            </li>
            <li>
              Connected YouTube channels: channel identifiers, metadata, video and comment data,
              analytics and OAuth credentials needed to perform actions you authorize.
            </li>
            <li>
              Files you submit: videos staged for upload, thumbnails, AI prompts and images.
              Publishing sends the selected content to YouTube.
            </li>
            <li>
              Operational data: IP address, request/error logs, approximate browser/OS session
              information, and limited performance/error diagnostics when monitoring is configured.
            </li>
            <li>
              Support and safety reports you send, and payment/referral transaction or payout
              information where applicable.
            </li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">Why and with whom</h2>
          <p>
            We use data to authenticate accounts, connect your channels, provide requested tools,
            track plan limits, deliver opted-in notifications/reports, process existing payments and
            investigate errors or abuse. We do not sell personal data.
          </p>
          <p>
            Our infrastructure and delivery providers may include Render, Vercel, Cloudflare,
            MongoDB, Redis/Upstash, Google Cloud Storage, Cloudinary, Brevo and Sentry, depending on
            the configured feature. Website payments use Dodo Payments and supported Android
            purchases use Google Play Billing; older transactions may involve Stripe or Razorpay. We
            store encrypted Google Play purchase tokens and subscription status to verify access,
            renewals and refunds. Providers process data needed for their function under their
            applicable terms.
          </p>
        </section>
        <section id="ai-data" className="space-y-3 scroll-mt-5">
          <h2 className="text-xl text-white font-semibold">AI data and your choices</h2>
          <p>
            When you request AI features, submitted text/images and relevant selected channel
            metadata or comments may be sent to DeepSeek, Google Gemini, Groq or Anthropic.
            Thumbnail image generation uses Cloudflare Workers AI; generated images may be stored on
            Cloudinary. Routing depends on the task and configured provider.
          </p>
          <p>
            AI outputs can be inaccurate or offensive. Review and edit them before publishing. Avoid
            submitting secrets or information you lack permission to share. You can use non-AI
            features without generating AI content. Use “Report AI content” in AI-related screens to
            report unsafe output within Vezrin.
          </p>
          <p>
            Provider retention and data-use practices depend on their terms and the service/account
            configuration. Contact us for details or help with a provider deletion request. We do
            not promise zero retention or that every configured provider excludes all processing for
            model improvement.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">YouTube permissions</h2>
          <p>
            Channel access is optional and uses Google's consent flow. You can disconnect a channel
            in Vezrin and revoke authorization through{' '}
            <a className="text-brand underline" href="https://myaccount.google.com/permissions">
              Google account permissions
            </a>
            . Disconnecting stops Vezrin access; it does not delete videos or comments already on
            YouTube. Data already held by YouTube remains governed by Google's policies.
          </p>
        </section>
        <section id="account-deletion" className="space-y-3 scroll-mt-5">
          <h2 className="text-xl text-white font-semibold">Delete your account and data</h2>
          <p>
            <Link className="text-brand underline" to="/delete-account">
              Open Vezrin account deletion
            </Link>
            . This page works in a browser without reinstalling the app. Signed-in users can confirm
            with their current password. If you cannot sign in, email{' '}
            <a
              className="text-brand underline"
              href="mailto:hello@vezrin.com?subject=Vezrin%20account%20deletion%20request"
            >
              hello@vezrin.com
            </a>{' '}
            from your registered address; we may verify ownership. Never send your password.
          </p>
          <p>
            After a confirmed in-app request, access is deactivated and future Vezrin-managed jobs
            stop. Account profile, stored channel/video/comment metadata, analytics, AI history,
            session and notification records and retained upload/thumbnail files are scheduled for
            deletion within 30 days. For email requests the window starts after ownership
            verification.
          </p>
          <p>
            Disconnecting only a YouTube channel schedules that channel's stored data for deletion
            after 30 days. Published content and schedules already sent to YouTube must be managed
            on YouTube.
          </p>
          <p>
            Minimal payment/referral transactions may be retained for tax, accounting, dispute or
            fraud obligations. Payout destination details are removed during account cleanup.
            Hosting logs, AI-provider records and backup copies have provider-specific retention
            windows; contact us for assistance requesting their deletion. Provider failures may
            require support intervention and retry; please contact us if a request is not completed
            within the stated period.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">Storage and security</h2>
          <p>
            We use HTTPS, bcrypt password hashing and authenticated access controls. OAuth
            credentials are kept server-side and excluded from ordinary API responses.
            Authentication tokens and preferences may be kept in local storage or secure server
            cookies. Sign out on shared devices. Hosting/database encryption, backups and retention
            depend on provider settings; no system is completely secure.
          </p>
          <p>
            We do not use an advertising SDK in this application. Optional Sentry monitoring records
            errors and sampled performance diagnostics. We avoid sending passwords, authorization
            headers and token query parameters to monitoring.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">Other rights and children</h2>
          <p>
            You may request access, correction, export or deletion by contacting us. Marketing email
            is opt-in and preferences can be changed in Settings. Data may be processed
            internationally by our providers. Legal rights depend on your location.
          </p>
          <p>
            Vezrin is not intended for children under 13. If you believe a child supplied personal
            information, contact us so we can investigate and remove it.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl text-white font-semibold">Contact and changes</h2>
          <p>
            VibeCore Technologies, India ·{' '}
            <a className="text-brand underline" href="mailto:hello@vezrin.com">
              hello@vezrin.com
            </a>
            . Material changes will be reflected on this page with an updated date and additional
            notice where required.
          </p>
        </section>
      </div>
    </main>
  )
}
