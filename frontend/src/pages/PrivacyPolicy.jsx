// src/pages/PrivacyPolicy.jsx
// Privacy Policy page for Vezrin

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-800/50 rounded-lg p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-400 mb-8">Last Updated: July 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
            <p>
              Vezrin ("we", "us", "our", or "Company") operates the Vezrin website and application. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
            </p>
            <p>
              We use your data to provide and improve the Service. By using Vezrin, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* 1. Information Collection */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">Personal Information</h3>
            <p>
              When you register for Vezrin, we collect:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Name</li>
              <li>Email address</li>
              <li>Password (encrypted)</li>
              <li>Avatar/Profile picture (optional)</li>
              <li>Bio/Description (optional)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">YouTube Data</h3>
            <p>
              When you connect your YouTube channel, we collect:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>YouTube Channel ID</li>
              <li>Channel name and description</li>
              <li>Subscriber count and analytics</li>
              <li>Video metadata and performance data</li>
              <li>Audience demographics (anonymized)</li>
              <li>YouTube OAuth refresh token (encrypted)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">Usage Data</h3>
            <p>
              We automatically collect usage data including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Pages visited and features used</li>
              <li>Time spent on the platform</li>
              <li>Device information (OS, browser type)</li>
              <li>IP address</li>
              <li>Referral source</li>
              <li>Cookies and tracking technology data</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-6 mb-3">Communication Data</h3>
            <p>
              When you contact us:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Email messages</li>
              <li>Support tickets</li>
              <li>Feedback and suggestions</li>
              <li>Chat interactions</li>
            </ul>
          </section>

          {/* 2. How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p>
              Vezrin uses the collected data for various purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>To provide and maintain the Service</li>
              <li>To notify you about changes to the Service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve the Service</li>
              <li>To monitor the usage of the Service</li>
              <li>To detect, prevent, and address technical issues</li>
              <li>To send promotional emails (with your consent)</li>
              <li>To provide personalized recommendations</li>
              <li>To generate anonymous analytics and reports</li>
            </ul>
          </section>

          {/* 3. Legal Basis */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Legal Basis for Processing</h2>
            <p>
              We process your personal data based on:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your explicit consent (for marketing communications)</li>
              <li>Performance of contract (to provide the Service)</li>
              <li>Legitimate interests (to improve the Service, prevent fraud)</li>
              <li>Compliance with legal obligations</li>
            </ul>
          </section>

          {/* 4. Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Retention</h2>
            <p>
              Vezrin will retain your Personal Data only for as long as necessary for the purposes set out in this Privacy Policy. We will retain and use your Personal Data to the extent necessary to comply with our legal obligations.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Account data: Retained while account is active + 90 days after deletion</li>
              <li>YouTube data: Retained while connected + 30 days after disconnection</li>
              <li>
                Server request/error logs: Retained per our hosting and monitoring providers'
                own log-retention windows, not by Vezrin directly
              </li>
              <li>Backup data: Retained for disaster recovery purposes</li>
            </ul>
          </section>

          {/* 5. Data Security */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Security</h2>
            <p>
              The security of your data is important to us. We use industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>SSL/TLS encryption for data in transit</li>
              <li>Bcrypt hashing for passwords</li>
              <li>Encrypted storage for sensitive data at rest</li>
              <li>Secure OAuth token handling</li>
              <li>Access controls and authentication</li>
              <li>Provider-level firewall and DDoS protection (Cloudflare/Render/Vercel)</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission over the Internet is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
            </p>
          </section>

          {/* 6. Sharing of Data */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Sharing of Your Data</h2>
            <p>
              We do NOT sell, trade, or rent your personal information. We may share your data in the following cases:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third parties that help us operate the Service (hosting, analytics, payment processing)</li>
              <li><strong>YouTube API:</strong> We share only necessary data to provide YouTube integration features</li>
              <li><strong>Legal Requirements:</strong> If required by law or to protect our rights</li>
              <li><strong>Business Transfer:</strong> In case of merger, acquisition, or sale of assets</li>
              <li><strong>Aggregated Data:</strong> Anonymous, aggregated data for analytics and research</li>
            </ul>
          </section>

          {/* 7. Third-Party Links */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Third-Party Links</h2>
            <p>
              Vezrin may contain links to external websites that are not operated by us. This Privacy Policy does not apply to third-party websites. We strongly advise you to review the privacy policies of any third-party website before providing your personal information.
            </p>
            <p className="mt-4">
              We are not responsible for the privacy practices of third-party websites.
            </p>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookies</h2>
            <p>
              Vezrin uses cookies to enhance your experience. Cookies are small files stored on your device.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Session Cookies:</strong> Temporary cookies that expire when you close your browser</li>
              <li><strong>Persistent Cookies:</strong> Stored for longer periods to remember your preferences</li>
              <li><strong>Third-party Cookies:</strong> From analytics and advertising services</li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings. Disabling cookies may affect the functionality of Vezrin.
            </p>
          </section>

          {/* 9. Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Your Data Rights</h2>
            <p>
              Under applicable data protection laws, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
              <li><strong>Erasure:</strong> Request deletion of your data (with exceptions)</li>
              <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
              <li><strong>Data Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Withdraw Consent:</strong> Opt-out of marketing communications</li>
              <li><strong>Object:</strong> Object to certain types of processing</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at hello@vezrin.com
            </p>
          </section>

          {/* 10. Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
            <p>
              Vezrin is not intended for children under 13 years of age. We do not knowingly collect personal data from children under 13. If we become aware that a child under 13 has provided us with personal data, we will delete such information immediately.
            </p>
            <p className="mt-4">
              If you believe a child has provided their information to Vezrin, please contact us immediately at hello@vezrin.com
            </p>
          </section>

          {/* 11. California Privacy Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to know what personal information is collected</li>
              <li>Right to know whether your personal information is sold or disclosed</li>
              <li>Right to say no to the sale of personal information</li>
              <li>Right to delete personal information collected from you</li>
              <li>Right to non-discrimination for exercising your CCPA rights</li>
            </ul>
          </section>

          {/* 12. GDPR Compliance */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. GDPR Compliance (EU Users)</h2>
            <p>
              For EU residents, Vezrin complies with the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We process data based on legal basis (consent, contract, or legitimate interest)</li>
              <li>We implement Privacy by Design principles</li>
              <li>You have rights to access, rectify, erase, restrict, and port your data</li>
              <li>Our Data Protection Officer, Raj Yadav, is available at hello@vezrin.com for any GDPR-related inquiries</li>
            </ul>
          </section>

          {/* 13. International Data Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. International Data Transfers</h2>
            <p>
              Your data may be transferred to, and maintained in, computers located outside your state, province, country, or other governmental jurisdiction where privacy laws may differ. If you are located outside India and choose to provide information to us, you consent to the transfer of your data to India and its processing there.
            </p>
          </section>

          {/* 14. Data Breach Notification */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Data Breach Notification</h2>
            <p>
              If we discover a data breach that compromises your personal information, we will notify you by email as soon as reasonably possible, and notify relevant authorities if required by law.
            </p>
          </section>

          {/* 15. Marketing Communications */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Marketing Communications</h2>
            <p>
              We may send you marketing emails if you opt-in. You can:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Opt-out via the "Unsubscribe" link in emails</li>
              <li>Change preferences in your account settings</li>
              <li>Request complete removal from our mailing list</li>
            </ul>
          </section>

          {/* 16. Policy Updates */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date above.
            </p>
            <p className="mt-4">
              Your continued use of Vezrin after such modifications constitutes your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* 17. Contact Us */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">17. Contact Information</h2>
            <p>
              If you have questions about this Privacy Policy or our privacy practices:
            </p>
            <p className="mt-4">
              <strong>Email:</strong> hello@vezrin.com<br />
              <strong>Website:</strong> vezrin.com<br />
              <strong>Address:</strong> India
            </p>
            <p className="mt-4">
              <strong>Data Protection Officer:</strong> Raj Yadav — hello@vezrin.com<br />
              (For GDPR-related queries)
            </p>
          </section>

          {/* Footer */}
          <section className="pt-8 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              By using Vezrin, you acknowledge that you have read, understood, and agree to this Privacy Policy.
            </p>
            <p className="text-sm text-slate-400 mt-4">
              © 2024-2026 Vezrin. All rights reserved.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
