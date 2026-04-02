"use client";
import { useState } from "react";
import { ShieldCheck, Users, BarChart2, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 grid lg:grid-cols-2 min-h-[calc(100vh-4rem)]">

        {/* Left panel */}
        <div className="relative bg-background text-foreground flex flex-col justify-start items-center px-12 py-10 overflow-hidden border-r border-border">
          {/* decorative circles */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-primary/10" />
          <div className="absolute top-40 -left-10 w-34 h-34 rounded-full bg-primary/10" />
          <div className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full bg-primary/10" />
          <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full bg-primary/10" />

          <div className="relative z-10 text-center w-full">
            <span className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-6">
              Academic FBI
            </span>
            <h1 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
              Register Here
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-16 max-w-sm mx-auto">
              Integrate your university with help of our software. Fill out the details and our team will
              guide you to get started soon.
            </p>

            <div className="space-y-8 inline-flex flex-col items-start">
              {[
                { icon: ShieldCheck, title: "Secure & Private", desc: "Encrypted data with role restricted access" },
                { icon: Users, title: "Built for Universities", desc: "Supports students, instructors, and admins" },
                { icon: BarChart2, title: "Detailed Analysis", desc: "Similarity reports with severity scoring" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex items-start justify-center px-8 py-4 bg-muted/30">
          {submitted ? (
            <div className="w-full max-w-md mt-0 border border-border rounded-2xl shadow-lg p-10 bg-card text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <p className="text-xl font-semibold text-foreground">Thanks for reaching out!</p>
              <p className="text-sm text-muted-foreground">One of our team members will be in touch with you soon.</p>
            </div>
          ) : (
            <form
              className="w-full max-w-lg mt-0 space-y-4 border border-border rounded-2xl shadow-lg p-8 bg-card"
              onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            >
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground">Fill in your details and we'll get back to you.</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Dave"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Bockus"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Your Role <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Administrator"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">University Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Brock University"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  placeholder="dbockus@university.ca"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Message <span className="text-red-500">*</span></label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your institution and what you're looking for...."
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
