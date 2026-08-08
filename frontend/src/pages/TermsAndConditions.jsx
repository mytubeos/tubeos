// src/pages/TermsAndConditions.jsx
// Terms & Conditions page for Vezrin

export function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-800/50 rounded-lg p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-white mb-2">Terms & Conditions</h1>
        <p className="text-slate-400 mb-8">Last Updated: July 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
          {/* 1. Agreement */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing and using Vezrin ("Service"), you accept and agree to be bound by the
              terms and provision of this agreement. If you do not agree to abide by the above,
              please do not use this service.
            </p>
            <p>
              Vezrin is an AI-powered YouTube creator management platform designed to help content
              creators optimize their channel performance, manage videos, and engage with their
              audience.
            </p>
          </section>

          {/* 2. Use License */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information
              or software) on Vezrin for personal, non-commercial transitory viewing only. This is
              the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to decompile or reverse engineer any software contained on the site</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
              <li>
                Transfer the materials to another person or "mirror" the materials on any other
                server
              </li>
              <li>Attempt to gain unauthorized access to any portion of the site</li>
              <li>Harass or cause distress or inconvenience to any person</li>
              <li>Disrupt the normal flow of dialogue within the site</li>
            </ul>
          </section>

          {/* 3. YouTube Integration */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. YouTube Integration & Data</h2>
            <p>
              Vezrin integrates with YouTube's API to provide analytics, video management, and
              creator tools. By using our Service:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You authorize Vezrin to access your YouTube channel data</li>
              <li>You must have the right to access and manage the YouTube channels you connect</li>
              <li>You comply with YouTube's Terms of Service</li>
              <li>We store limited YouTube data to provide better analytics</li>
              <li>You can disconnect your YouTube account at any time</li>
              <li>All YouTube data access complies with YouTube's Data API policies</li>
            </ul>
          </section>

          {/* 4. Account Registration */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Account Registration</h2>
            <p>To use Vezrin, you must create an account by providing:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Valid email address</li>
              <li>Strong password (minimum 8 characters)</li>
              <li>Accurate and complete information</li>
            </ul>
            <p className="mt-4">
              You are responsible for maintaining the confidentiality of your account credentials.
              You agree to accept responsibility for all activities that occur under your account.
              You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          {/* 5. User Content & Responsibility */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. User Content & Responsibility</h2>
            <p>
              You retain all rights to any content you create using Vezrin. However, you grant
              Vezrin a license to use your content to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and improve the Service</li>
              <li>Display analytics and insights</li>
              <li>Create aggregate, anonymized reports</li>
            </ul>
            <p className="mt-4">You represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You have the right to create and share the content</li>
              <li>Your content does not violate any laws or third-party rights</li>
              <li>Your content is accurate and truthful</li>
            </ul>
          </section>

          {/* 6. Disclaimer */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Disclaimer</h2>
            <p>
              The materials on Vezrin are provided on an 'as is' basis. Vezrin makes no warranties,
              expressed or implied, and hereby disclaims and negates all other warranties including,
              without limitation, implied warranties or conditions of merchantability, fitness for a
              particular purpose, or non-infringement of intellectual property or other violation of
              rights.
            </p>
            <p className="mt-4">
              Further, Vezrin does not warrant or make any representations concerning the accuracy,
              likely results, or reliability of the use of the materials on its website or otherwise
              relating to such materials or on any sites linked to this site.
            </p>
          </section>

          {/* 7. Limitations */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Limitations</h2>
            <p>
              In no event shall Vezrin or its suppliers be liable for any damages (including,
              without limitation, damages for loss of data or profit, or due to business
              interruption) arising out of the use or inability to use the materials on Vezrin, even
              if Vezrin or an authorized representative has been notified orally or in writing of
              the possibility of such damage.
            </p>
          </section>

          {/* 8. Accuracy of Materials */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Accuracy of Materials</h2>
            <p>
              The materials appearing on Vezrin could include technical, typographical, or
              photographic errors. Vezrin does not warrant that any of the materials on the site are
              accurate, complete, or current. Vezrin may make changes to the materials contained on
              the site at any time without notice.
            </p>
          </section>

          {/* 9. Links */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Links</h2>
            <p>
              Vezrin has not reviewed all of the sites linked to its website and is not responsible
              for the contents of any such linked site. The inclusion of any link does not imply
              endorsement by Vezrin of the site. Use of any such linked website is at the user's own
              risk.
            </p>
          </section>

          {/* 10. Modifications */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Modifications</h2>
            <p>
              Vezrin may revise these terms of service for the website at any time without notice.
              By using this website, you are agreeing to be bound by the then current version of
              these terms of service.
            </p>
          </section>

          {/* 11. Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws
              of India, and you irrevocably submit to the exclusive jurisdiction of the courts in
              that location.
            </p>
          </section>

          {/* 12. Subscription & Payment */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Subscription & Payment</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Vezrin offers different subscription plans (Free, Creator, Pro, Max)</li>
              <li>Payments are processed securely through Razorpay</li>
              <li>Subscriptions renew automatically unless cancelled</li>
              <li>You can cancel your subscription anytime from your account settings</li>
              <li>No refunds for partial months or cancellations</li>
              <li>We reserve the right to change pricing with 30 days notice</li>
            </ul>
          </section>

          {/* 13. Free Trial */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Free Plan</h2>
            <p>
              The free plan includes basic features. Full features are available with paid plans. We
              may limit free tier usage at our discretion.
            </p>
          </section>

          {/* 14. Acceptable Use */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Acceptable Use Policy</h2>
            <p>You agree not to use Vezrin:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>For illegal purposes or in violation of any laws</li>
              <li>To harass, abuse, or threaten others</li>
              <li>To spam or send unsolicited messages</li>
              <li>To infringe on anyone's intellectual property rights</li>
              <li>To spread malware or viruses</li>
              <li>To attempt unauthorized access to the system</li>
              <li>To overload or disrupt the service</li>
              <li>To scrape or automate access without permission</li>
            </ul>
          </section>

          {/* 15. Termination */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Termination of Service</h2>
            <p>Vezrin may, in its sole discretion, terminate your account if:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You violate these Terms & Conditions</li>
              <li>You engage in illegal activity</li>
              <li>You spam or abuse the service</li>
              <li>Your account shows suspicious activity</li>
              <li>Payment fails repeatedly</li>
            </ul>
            <p className="mt-4">
              Upon termination, your access to Vezrin will be revoked immediately.
            </p>
          </section>

          {/* 16. Support & Service Level */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Support & Service Level</h2>
            <p>
              Vezrin provides email support for all users. Premium support is available with paid
              plans. We aim to respond to support requests within 48 business hours.
            </p>
            <p className="mt-4">
              We do not guarantee 100% uptime. Scheduled maintenance may cause temporary
              unavailability.
            </p>
          </section>

          {/* 17. Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">17. Third-Party Services</h2>
            <p>
              Vezrin integrates with third-party services (including the YouTube Data API, DeepSeek,
              Google Gemini, Groq, Cloudflare, Cloudinary, and Razorpay). Your use of features
              backed by these services is subject to their own terms and conditions. We are not
              responsible for their services, availability, or data handling.
            </p>
          </section>

          {/* 18. Feedback */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">18. Feedback & Suggestions</h2>
            <p>
              Any feedback, comments, or suggestions you provide to Vezrin may be used freely
              without any obligation to you. We may use this feedback to improve the Service.
            </p>
          </section>

          {/* 19. Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">19. Contact Information</h2>
            <p>If you have any questions about these Terms & Conditions, please contact us at:</p>
            <p className="mt-4">
              Email: hello@vezrin.com
              <br />
              Website: vezrin.com
            </p>
          </section>

          {/* Footer */}
          <section className="pt-8 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              By using Vezrin, you acknowledge that you have read, understood, and agree to be bound
              by all the terms and conditions stated above.
            </p>
            <p className="text-sm text-slate-400 mt-4">© 2024-2026 Vezrin. All rights reserved.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
