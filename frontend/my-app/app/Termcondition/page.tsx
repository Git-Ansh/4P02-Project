"use client";
import { useState } from "react";
import { Header } from "@/components/header";

const privacySections = [
  {
    title: "Information we collect",
    content:
      "We collect information you provide directly to us when you register an account, including your name, email address, university affiliation, and role (student, instructor, or administrator). We also collect usage data such as pages visited, actions taken, and login timestamps to improve the platform experience.",
  },
  {
    title: "How we use your information",
    content:
      "Your information is used solely to operate and improve Academic FBI. This includes authenticating your account, displaying relevant course and student data based on your role, and communicating important updates. We do not sell or share your personal data with third parties for marketing purposes.",
  },
  {
    title: "Data storage & security",
    content:
      "All data is stored securely using industry-standard encryption. Access to personal data is restricted by role — admins, instructors, and students each see only the data relevant to them. We take reasonable technical and organizational measures to protect your information from unauthorized access.",
  },
  {
    title: "Cookies",
    content:
      "Academic FBI uses session cookies to keep you logged in and to remember your preferences. These cookies are strictly necessary for the platform to function and are not used for tracking or advertising. You can disable cookies in your browser settings, but some features may not work as expected.",
  },
  {
    title: "Your rights",
    content:
      "You have the right to access, correct, or request deletion of your personal data at any time. To make a request, please contact your institution's administrator or reach out to us directly. We will respond to all requests within a reasonable timeframe in accordance with applicable privacy laws.",
  },
  {
    title: "Changes to this policy",
    content:
      "We may update this Privacy Policy from time to time. We encourage you to review this page periodically to stay informed about how we protect your information.",
  },
];

const termsSections = [
  {
    title: "Acceptance of terms",
    content:
      "By accessing or using Academic FBI, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the platform. These terms apply to all users including students, instructors, and administrators.",
  },
  {
    title: "Use of the platform",
    content:
      "Academic FBI is intended for use by authorized members of participating educational institutions only. You agree to use the platform solely for legitimate academic and administrative purposes. Any unauthorized use, including attempting to access accounts or data that does not belong to you, is strictly prohibited.",
  },
  {
    title: "User accounts",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify your administrator immediately if you suspect unauthorized access to your account. Academic FBI is not liable for any loss resulting from unauthorized use of your credentials.",
  },
  {
    title: "Intellectual property",
    content:
      "All content, design, code, and materials on Academic FBI are the property of the development team and the participating institution. You may not reproduce, distribute, or create derivative works from any part of the platform without explicit written permission.",
  },
  {
    title: "Limitation of liability",
    content:
      "Academic FBI is provided as a project platform on an 'as is' basis. We make no warranties regarding uptime, data accuracy, or fitness for a particular purpose. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.",
  },
  {
    title: "Termination",
    content:
      "We reserve the right to suspend or terminate access to Academic FBI for any user who violates these terms or engages in conduct deemed harmful to other users or the platform. Termination decisions made by administrators of your institution are outside our direct control.",
  },
  {
    title: "Governing law",
    content:
      "These terms are governed by the laws of the Province of Ontario, Canada. Any disputes arising from the use of Academic FBI shall be resolved in accordance with applicable Canadian law.",
  },
];

type Tab = "privacy" | "terms";

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("privacy");

  const sections = activeTab === "privacy" ? privacySections : termsSections;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <span className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
            Legal
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
            Privacy & Terms
          </h1>
        </div>
      </section>

      {/* Tab switcher */}
      <div className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("privacy")}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "privacy"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "terms"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Terms & Conditions
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="space-y-10">
          {sections.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {i + 1}. {section.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            If you have any questions about our{" "}
            {activeTab === "privacy" ? "Privacy Policy" : "Terms & Conditions"},
            please contact your institution administrator.
          </p>
        </div>
      </section>

    </div>
  );
}