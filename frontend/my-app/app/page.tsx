"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import { getUniversities, University } from "@/lib/api"
import {
  LockIcon,
  BookCopyIcon,
  Calendar1Icon,
  LandmarkIcon,
  CalendarDaysIcon,
  PackageIcon,
  ShieldIcon,
  LockOpenIcon,
  AlertTriangleIcon,
  ClipboardListIcon,
  CheckIcon,
  XIcon,
  GraduationCap,
  UserCog,
  Upload,
} from "lucide-react"

const pageStyles = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');

.afbiWrap {
  --accent: #f97316;
  --accentGlow: rgba(249,115,22,0.14);
  --accentDim: rgba(249,115,22,0.08);
  --bg: rgba(255,255,255,0.85); --bg2: rgba(248,245,240,0.88); --bg3: rgba(240,236,228,0.9);
  --card: rgba(255,255,255,0.92); --card2: rgba(248,245,240,0.9);
  --fg: #0f0e0c; --fg2: #3a3630; --muted: #7a7268;
  --border: rgba(0,0,0,0.08); --borderS: rgba(0,0,0,0.14);
  --shadow: rgba(0,0,0,0.07); --shadowS: rgba(0,0,0,0.18);
  --gridLine: rgba(0,0,0,0.07);
}
.dark .afbiWrap {
  --accent: #06b6d4;
  --accentGlow: rgba(6,182,212,0.14);
  --accentDim: rgba(6,182,212,0.07);
  --bg: rgba(8,8,9,0.82); --bg2: rgba(16,16,19,0.85); --bg3: rgba(22,22,25,0.88);
  --card: rgba(18,18,21,0.9); --card2: rgba(25,25,32,0.88);
  --fg: #efefef; --fg2: #a8a8b0; --muted: #606068;
  --border: rgba(255,255,255,0.07); --borderS: rgba(255,255,255,0.13);
  --shadow: rgba(0,0,0,0.45); --shadowS: rgba(0,0,0,0.75);
  --gridLine: rgba(255,255,255,0.045);
}

.playfair { font-family:'Playfair Display',serif; }
.outfit { font-family:'Outfit',sans-serif; }
.mono { font-family:'JetBrains Mono',monospace; }

@keyframes fadeUp { to { opacity:1; transform:translateY(0) } }
@keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-28px,-38px) scale(1.07)} 66%{transform:translate(18px,22px) scale(.96)} }
@keyframes blob2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(28px,-22px)} }
@keyframes dropIn { 0%{opacity:0;transform:translateY(-90px) scale(0.88)} 60%{opacity:1;transform:translateY(12px) scale(1.03)} 80%{transform:translateY(-5px) scale(0.99)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes riseIn { 0%{opacity:0;transform:translateY(90px) scale(0.88)} 60%{opacity:1;transform:translateY(-12px) scale(1.03)} 80%{transform:translateY(5px) scale(0.99)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes slideIn { 0%{opacity:0;transform:translateX(90px) scale(0.88)} 60%{opacity:1;transform:translateX(-10px) scale(1.03)} 80%{transform:translateX(4px) scale(0.99)} 100%{opacity:1;transform:translateX(0) scale(1)} }
@keyframes scrollLoop { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }

.fadeUp1 { opacity:0;transform:translateY(18px);animation:fadeUp .8s .2s forwards; }
.fadeUp2 { opacity:0;transform:translateY(18px);animation:fadeUp 1s .4s forwards; }
.fadeUp3 { opacity:0;transform:translateY(18px);animation:fadeUp 1s .6s forwards; }
.fadeUp4 { opacity:0;transform:translateY(18px);animation:fadeUp .8s .85s forwards; }
.blob1 { animation:blob1 10s ease-in-out infinite; }
.blob2 { animation:blob2 13s ease-in-out infinite; }
.dropIn { opacity:0; animation:dropIn .9s ease .47s forwards; }
.slideIn { opacity:0; animation:slideIn .9s ease .80s forwards; }
.riseIn { opacity:0; animation:riseIn .9s ease 1.15s forwards; }
.scrollLoop { animation:scrollLoop 30s linear infinite; }
.blink { animation:blink 2s infinite; }

.reveal { opacity:0;transform:translateY(38px); transition:opacity .8s ease,transform .8s ease; }
.revealLeft { opacity:0;transform:translateX(-38px);transition:opacity .8s,transform .8s; }
.revealRight { opacity:0;transform:translateX(38px); transition:opacity .8s,transform .8s; }
.reveal.on,.revealLeft.on,.revealRight.on { opacity:1;transform:none; }

.heroGrid {
  position:absolute;inset:0;
  background-image:linear-gradient(var(--gridLine) 1px,transparent 1px),linear-gradient(90deg,var(--gridLine) 1px,transparent 1px);
  background-size:40px 40px;
  mask-image:radial-gradient(ellipse 90% 80% at 50% 50%,black 15%,transparent 78%);
}

.docLine {height:7px;border-radius:4px;margin-bottom:7px;background:var(--bg3) }
.lineOrange {background:rgba(249,115,22,.32);width:90%;}
.lineOrangeBold {background:rgba(249,115,22,.52);width:74%;}
.lineRed {background:rgba(239,68,68,.38);width:62%;}
.lineShort {width:54%;}
.lineMid {width:82%;}
.dark .afbiWrap .lineOrange { background:rgba(6,182,212,.32); }
.dark .afbiWrap .lineOrangeBold { background:rgba(6,182,212,.52); }
.dotLabel::before {content:'';width:5px;height:5px;background:var(--accent);border-radius:50%;display:inline-block; }

.howOuter {overflow:hidden; padding:112px 48px;}
.howRow {display:flex; align-items:center; justify-content:center; flex-wrap:wrap; margin:72px auto 0; width:100%; gap:24px; }
.stepNode {position:relative; flex:1; min-width:200px; display:flex; justify-content:center; opacity:0; transform:scale(.5) translateY(28px); transition:opacity .65s ease,transform .75s cubic-bezier(.34,1.56,.64,1);}
.stepNode.on {opacity:1; transform:scale(1) translateY(0);}
.circleOuter {width:290px;height:290px;border-radius:50%;background:var(--accentDim);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 44px var(--accentGlow);transition:transform .3s,box-shadow .3s,background .4s;cursor:default; }
.circleOuter:hover {transform:scale(1.06); box-shadow:0 18px 60px var(--accentGlow);}
.circleInner {width:238px;height:238px;border-radius:50%;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px;text-align:center;gap:6px;transition:background .4s;}
.stepWord {font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-top:3px;}
.stepText {font-size:12px;line-height:1.6;color:var(--fg2);margin-top:5px;}
.stepArrow { flex-shrink:0;width:60px;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateX(-10px);transition:opacity .4s ease,transform .4s ease; }
.stepArrow.on {opacity:1; transform:translateX(0);}

@media (max-width: 768px) {
  .howOuter { padding: 64px 24px; }
  .howRow { margin-top: 40px; }
  .stepArrow { display: none; }
  .circleOuter { width: 200px; height: 200px; }
  .circleInner { width: 162px; height: 162px; padding: 18px; }
}

.ringTrack {fill:none;stroke-width:3;stroke:var(--borderS);}
.ringFill { fill:none;stroke-width:3;stroke:#ef4444;stroke-linecap:round;stroke-dasharray:101;stroke-dashoffset:25; }
.floatWord {willchange:transform;}
.roleCard {willchange:transform;}
`

const scrollingBanner = [
  "Course-Scoped Detection", "Anonymous Review Mode", "ZIP File Submissions",
  "Email Token Verification", "Cross-Year Comparison", "Identity Reveal on Request",
  "University Admin Dashboard", "Trusted by 50+ Universities",
]

const heroBadges = [
  { icon: LockIcon, text: "Privacy-First" },
  { icon: BookCopyIcon, text: "Peer Detection" },
  { icon: CalendarDaysIcon, text: "Cross-Year verification" },
  { icon: LandmarkIcon, text: "50+ Universities" },
]

const steps = [
  { id: "s1", arrowId: "a12", word: "Create",  text: "Instructor creates an assignment for courses they are teaching with all required guidelines." },
  { id: "s2", arrowId: "a23", word: "Notify",  text: "Student gets an email to submit the assignment with deadline and token." },
  { id: "s3", arrowId: "a34", word: "Submit",  text: "Only allows ZIP submission and token verification maintains security." },
  { id: "s4", arrowId: null,  word: "Analyse", text: "Peer-to-peer comparison is processed and instructor can add previous year assignment for cross-year detection." },
]

const privacyFeatures = [
  { icon: ShieldIcon, title: "Hidden Identities all time", desc: "Instructors see submission content, similarity, severity scores — never names or IDs." },
  { icon: LockOpenIcon, title: "Reveal on Instructor Request", desc: "Once software detects plagiarism, instructors can send a request for identity reveal." },
  { icon: CalendarDaysIcon, title: "Cross-Year Verification", desc: "Instructors can cross-check against previous year submissions to catch same submission." },
]

const team = [
  { title: "Team Leader", people: [{ name: "Darsh Kurmi", initials: "DK" }], desc: "Aligns the team and handles all the communications." },
  { title: "Backend Developers", people: [{ name: "Rimon Paul", initials: "RP" }, { name: "Rishi Modi", initials: "RM" }, { name: "Paril Gabani", initials: "PG" }], desc: "Build the core plagiarism detection engine, logic detection in the submissions." },
  { title: "Deployment and FullStack Develpoer", people: [{ name: "Ansh Shah", initials: "AS" }], desc: "Bridges frontend and backend with help of databases for deployment." },
  { title: "UI/UX and Frontend Developer", people: [{ name: "Riya Shah", initials: "RS" }], desc: "Designs the interface and implements the functionalities." },
  { title: "Frontend Developer", people: [{ name: "Manu Saini", initials: "MS" }], desc: "Implements UI components and handles the website look for all devices." },
]

const ctaBadges = [
  { icon: LandmarkIcon, label: <><span style={{ color: "var(--accent)", fontWeight: 600 }}>50+</span> universities onboarded</> },
  { icon: LockIcon, label: "Privacy first" },
  { icon: PackageIcon, label: "ZIP-based submissions" },
  { icon: Calendar1Icon, label: "Cross-year detection" },
  { icon: ShieldIcon, label: "Anonymous review & analysis" },
]

const floatingWords = [
  { word: "ANONYMOUS", pos: { top: "12%", left: "7%" }, speed: "0.3" },
  { word: "VERIFIED", pos: { top: "72%", left: "5%" }, speed: "0.5" },
  { word: "ORIGINAL", pos: { top: "18%", right: "5%" }, speed: "0.4" },
  { word: "HONEST", pos: { top: "68%", right: "7%" }, speed: "0.22" },
  { word: "FAIR", pos: { top: "42%", left: "14%" }, speed: "0.55" },
  { word: "TRUSTED", pos: { top: "38%", right: "14%" }, speed: "0.35" },
]

function TagLine({ label, center = false }: { label: string; center?: boolean }) {
  return (
    <div className={`reveal mono flex items-center gap-3 text-[9px] tracking-[0.22em] uppercase mb-5 ${center ? "justify-center" : ""}`}
         style={{ color: "var(--accent)" }}>
      {label}
    </div>
  )
}

function RoleCard({ title, people, desc }: { title: string; people: { name: string; initials: string }[]; desc: string }) {
  return (
    <div className="roleCard relative overflow-hidden rounded-xl p-7 h-full"
         style={{ background: "var(--card)", border: "1px solid var(--border)", transition: "background .4s ease, border-color .4s ease" }}>
      <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: "var(--accent)" }} />
      <h3 className="playfair text-[1.85rem] leading-tight mb-5">{title}</h3>
      <div className="flex flex-wrap gap-3 mb-6">
        {people.map(p => (
          <div key={p.name} className="flex items-center gap-2.5 rounded-full px-2.5 py-2"
               style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold"
                 style={{ background: "var(--accentDim)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
              {p.initials}
            </div>
            <span className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>{p.name}</span>
          </div>
        ))}
      </div>
      <p className="text-[14px] leading-[1.9]" style={{ color: "var(--muted)" }}>{desc}</p>
    </div>
  )
}

function StepArrow({ id }: { id: string }) {
  return (
    <div className="stepArrow" id={id}>
      <svg width="72" height="24" viewBox="0 0 72 24" fill="none">
        <line x1="4" y1="12" x2="54" y2="12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 46,5 L 62,12 L 46,19" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const prevTheme = React.useRef<string | undefined>(undefined)
  const [animKey, setAnimKey] = React.useState(0)
  const [unis, setUnis] = React.useState<University[]>([])
  const [selectedUni, setSelectedUni] = React.useState("")
  const [unisLoading, setUnisLoading] = React.useState(true)

  React.useEffect(() => {
    getUniversities().then(setUnis).catch(() => {}).finally(() => setUnisLoading(false))
  }, [])

  React.useEffect(() => {
    if (!resolvedTheme) return
    if (prevTheme.current && prevTheme.current !== resolvedTheme) setAnimKey(k => k + 1)
    prevTheme.current = resolvedTheme
  }, [resolvedTheme])

  React.useEffect(() => {
    if (animKey === 0) return
    const ids = ["s1", "a12", "s2", "a23", "s3", "a34", "s4"]
    ids.forEach(id => document.getElementById(id)?.classList.remove("on"))
    const show = (id: string, ms: number) => setTimeout(() => document.getElementById(id)?.classList.add("on"), ms)
    const replay = () => {
      show("s1", 0); show("a12", 500); show("s2", 900)
      show("a23", 1300); show("s3", 1700); show("a34", 2100); show("s4", 2500)
    }
    const sec = document.getElementById("howSec")
    if (!sec) return
    const r = sec.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) {
      replay()
    } else {
      const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) { replay(); obs.disconnect() } }, { threshold: 0.15 })
      obs.observe(sec)
      return () => obs.disconnect()
    }
  }, [animKey])


  // scroll
  //hello
  React.useEffect(() => {
    const onScroll = () => {
      const px = document.getElementById("pxSec")
      const pb = document.getElementById("pxBg")
      if (px && pb) {
        const r = px.getBoundingClientRect()
        pb.style.transform = `translateY(${(-r.top / window.innerHeight) * 65}px)`
      }
      document.querySelectorAll<HTMLElement>(".floatWord").forEach(w => {
        w.style.transform = `translateY(${window.scrollY * parseFloat(w.dataset.speed ?? "0") * 0.12}px)`
      })
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  React.useEffect(() => {
    // scroll reveal
    const ro = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) (e.target as HTMLElement).classList.add("on") }),
      { threshold: 0.12 }
    )
    document.querySelectorAll(".reveal,.revealLeft,.revealRight").forEach(el => ro.observe(el))

    // animate the how-it-works circles one by one when section scrolls into view
    const howSec = document.getElementById("howSec")
    if (howSec) {
      let fired = false
      const show = (id: string, ms: number) => setTimeout(() => document.getElementById(id)?.classList.add("on"), ms)
      const run = () => {
        if (fired) return; fired = true
        show("s1", 0)
        show("a12", 500)
        show("s2", 900)
        show("a23", 1300)
        show("s3", 1700)
        show("a34", 2100)
        show("s4", 2500)
      }
      const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) { run(); obs.disconnect() } }, { threshold: 0.15 })
      obs.observe(howSec)
    }

    // count up numbers when they come into view
    const cu = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        const el = e.target as HTMLElement
        const to = parseInt(el.dataset.to ?? "0")
        let t0: number | null = null
        const step = (ts: number) => {
          if (!t0) t0 = ts
          const p = Math.min((ts - t0) / 1600, 1)
          el.textContent = String(Math.floor((1 - Math.pow(1 - p, 3)) * to))
          if (p < 1) requestAnimationFrame(step); else el.textContent = String(to)
        }
        requestAnimationFrame(step)
        cu.unobserve(el)
      })
    }, { threshold: 0.5 })
    document.querySelectorAll(".cnum").forEach(el => cu.observe(el))


    return () => { ro.disconnect(); cu.disconnect() }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      
      <Header />
      <div className="afbiWrap outfit flex-1"
           style={{ background: "transparent", color: "var(--fg)", overflowX: "hidden", transition: "color .5s" }}>


        {/* -------HERO----- */}
        <section className="relative min-h-screen flex items-center px-5 sm:px-8 lg:px-12 pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20 lg:pb-28 overflow-hidden">
          <div className="heroGrid" />
          <div className="absolute rounded-full pointer-events-none blob1" style={{ width: 500, height: 500, background: "var(--accentGlow)", filter: "blur(110px)", top: "-8%", right: "-3%" }} />
          <div className="absolute rounded-full pointer-events-none blob2" style={{ width: 320, height: 320, background: "var(--accentDim)", filter: "blur(110px)", bottom: 0, left: "-4%" }} />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-[1280px] mx-auto w-full">
            {/* Lefttext */}
            <div key={"l" + animKey}>
              <div className="inline-flex items-center gap-2 rounded px-3 py-1.5 mb-7 mono text-[10px] tracking-[0.2em] uppercase fadeUp1"
                   style={{ background: "var(--accentDim)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                Plagiarism Detection Platform
              </div>
              <h1 className="playfair fadeUp2" style={{ fontSize: "clamp(2.8rem,5.5vw,5.5rem)", lineHeight: 1.08, letterSpacing: "-.02em" }}>
                Catching <em style={{ fontStyle: "italic", color: "var(--accent)" }}>dishonesty</em><br />
                so <span style={{ color: "var(--muted)", fontWeight: 700 }}>Instructors</span><br />
                don't have to.
              </h1>
              <p className="mt-8 text-base leading-[1.78] max-w-[470px] fadeUp3" style={{ color: "var(--muted)" }}>
                Academic FBI is built for university to detect plagiarism. The software compares submissions within a course, hiding student identities to eliminate bias, and revealing them only when instructor sends a request.
              </p>
              <div className="flex flex-wrap gap-2 mt-8 fadeUp4">
                {heroBadges.map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-2 text-[11px] font-medium px-3 py-1 rounded-sm"
                        style={{ background: "var(--bg3)", border: "1px solid var(--borderS)", color: "var(--fg2)" }}>
                    <Icon size={13} className="text-orange-500 dark:text-cyan-400 shrink-0" />{text}
                  </span>
                ))}
              </div>
              <div className="mt-10 fadeUp4">
                <button
                  onClick={() => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })}
                  className="px-8 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.03]"
                  style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 24px var(--accentGlow)" }}
                >
                  Get Started
                </button>
              </div>
            </div>

            {/* Right cards */}
            <div key={"r" + animKey} className="relative h-[600px] hidden lg:block">
              {/* Card 1 drops from top */}
              <div className="absolute rounded-2xl p-7 dropIn" style={{ width: 295, top: 0, left: 0, minHeight: 240, background: "var(--card)", border: "1px solid var(--borderS)", boxShadow: "0 28px 64px var(--shadowS)", transition: "background .4s ease, border-color .4s ease" }}>
                <div className="dotLabel mono text-[9px] tracking-[0.18em] uppercase flex items-center gap-1.5 mb-5" style={{ color: "var(--accent)" }}>Student Submission</div>
                <div className="docLine lineMid" /><div className="docLine lineOrange" /><div className="docLine lineShort" />
                <div className="docLine lineOrangeBold" /><div className="docLine lineMid" /><div className="docLine lineRed lineShort" /><div className="docLine" />
                <div className="inline-flex items-center gap-1.5 mono text-[9px] px-2.5 py-1 rounded-full mt-4"
                     style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#ef4444" }}>
                  <AlertTriangleIcon size={10} /> 75% match detected
                </div>
                <div className="absolute top-4 right-4 w-12 h-12">
                  <svg width="48" height="48" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }}>
                    <circle className="ringTrack" cx="22" cy="22" r="16" />
                    <circle className="ringFill" cx="22" cy="22" r="16" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center mono text-[8px] font-medium" style={{ color: "#ef4444" }}>74%</div>
                </div>
              </div>

              {/* Card 2 slides from right */}
              <div className="absolute rounded-2xl p-7 slideIn" style={{ width: 280, top: 195, right: 0, minHeight: 240, background: "var(--card2)", border: "1px solid var(--border)", boxShadow: "0 28px 64px var(--shadowS)", transition: "background .4s ease, border-color .4s ease" }}>
                <div className="mono text-[9px] tracking-[0.18em] uppercase flex items-center gap-1.5 mb-5" style={{ color: "var(--accent)" }}>
                  <span className="w-1 h-1 rounded-full inline-block" style={{ background: "var(--accent)" }} />Anonymous Review
                </div>
                <div className="flex items-center gap-2 rounded-md px-3 py-2.5" style={{ background: "var(--accentDim)", border: "1px solid var(--accent)" }}>
                  <ShieldIcon size={14} style={{ color: "var(--accent)" }} />
                  <div className="mono text-[8px] leading-relaxed" style={{ color: "var(--accent)" }}>Identities hidden during review<br />to remain unbiased</div>
                </div>
                <div className="mt-4">
                  <div className="docLine lineOrange lineMid" /><div className="docLine lineOrangeBold lineShort" /><div className="docLine lineRed" /><div className="docLine lineMid" />
                </div>
                <div className="inline-flex items-center gap-1.5 mono text-[9px] px-2.5 py-1 rounded-full mt-4"
                     style={{ background: "var(--accentDim)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                  <ClipboardListIcon size={10} /> Instructor reviewing
                </div>
              </div>

              {/* Card 3 rises from bottom */}
              <div className="absolute rounded-2xl p-7 riseIn" style={{ width: 275, top: 305, left: 0, minHeight: 240, background: "var(--card)", border: "1px solid var(--borderS)", boxShadow: "0 28px 64px var(--shadowS)", transition: "background .4s ease, border-color .4s ease" }}>
                <div className="mono text-[9px] tracking-[0.18em] uppercase flex items-center gap-1.5 mb-5" style={{ color: "var(--accent)" }}>
                  <span className="w-1 h-1 rounded-full inline-block" style={{ background: "var(--accent)" }} />Similarity Analysis
                </div>
                <div className="mono text-[8px] leading-[2]">
                  <div className="flex items-center gap-1" style={{ color: "#22c55e" }}><CheckIcon size={10} /> method abc — Original</div>
                  <div className="flex items-center gap-1" style={{ color: "#ef4444" }}><XIcon size={10} /> math logic — 93% match</div>
                  <div className="flex items-center gap-1" style={{ color: "#ef4444" }}><XIcon size={10} /> method x— 77% match</div>
                  <div className="flex items-center gap-1" style={{ color: "#22c55e" }}><CheckIcon size={10} /> method prq — Original</div>
                </div>
                <div className="inline-flex items-center gap-1.5 mono text-[9px] px-2.5 py-1 rounded-full mt-4"
                     style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.28)", color: "#22c55e" }}>
                  <CheckIcon size={10} /> Analysis complete
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------ GET STARTED --------- */}
        <section id="get-started" className="relative py-20 px-12 overflow-hidden" style={{ background: "var(--bg2)", transition: "background .4s ease" }}>
          <div className="max-w-[560px] mx-auto text-center">
            <TagLine label="Get Started" center />
            <h2 className="reveal playfair mb-3" style={{ fontSize: "clamp(1.8rem,3vw,2.8rem)", lineHeight: 1.15, letterSpacing: "-.02em" }}>
              Select your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>institution</em>
            </h2>
            <p className="reveal text-sm mb-6" style={{ color: "var(--muted)" }}>
              Choose your university, then pick your role.
            </p>
            <div className="reveal">
              <select
                value={selectedUni}
                onChange={e => setSelectedUni(e.target.value)}
                className="w-full px-5 py-3 rounded-xl text-sm mb-4 outline-none transition-all"
                style={{ background: "var(--card)", border: "1px solid var(--borderS)", color: "var(--fg)", appearance: "auto" }}
              >
                <option value="">{unisLoading ? "Loading..." : "Select your university"}</option>
                {unis.map(u => <option key={u.id} value={u.slug}>{u.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button disabled={!selectedUni} onClick={() => router.push(`/login?university=${selectedUni}&role=instructor`)}
                  className="flex flex-col items-center gap-2 px-2 sm:px-4 py-4 sm:py-5 rounded-xl text-[11px] sm:text-[12px] font-medium transition-all disabled:opacity-25 hover:scale-[1.03]"
                  style={{ background: "var(--card)", border: "1px solid var(--borderS)", color: "var(--fg2)" }}>
                  <GraduationCap size={20} className="text-orange-500 dark:text-cyan-400" /> Instructor
                </button>
                <button disabled={!selectedUni} onClick={() => router.push(`/login?university=${selectedUni}&role=admin`)}
                  className="flex flex-col items-center gap-2 px-2 sm:px-4 py-4 sm:py-5 rounded-xl text-[11px] sm:text-[12px] font-medium transition-all disabled:opacity-25 hover:scale-[1.03]"
                  style={{ background: "var(--card)", border: "1px solid var(--borderS)", color: "var(--fg2)" }}>
                  <UserCog size={20} className="text-orange-500 dark:text-cyan-400" /> Administrator
                </button>
                <button disabled={!selectedUni} onClick={() => router.push(`/submit?university=${selectedUni}`)}
                  className="flex flex-col items-center gap-2 px-2 sm:px-4 py-4 sm:py-5 rounded-xl text-[11px] sm:text-[12px] font-medium transition-all disabled:opacity-25 hover:scale-[1.03]"
                  style={{ background: "var(--card)", border: "1px solid var(--borderS)", color: "var(--fg2)" }}>
                  <Upload size={20} className="text-orange-500 dark:text-cyan-400" /> Submit Work
                </button>
              </div>
              <p className="mt-4 text-[11px]" style={{ color: "var(--muted)" }}>
                Can&apos;t find your institution? <Link href="/contact" className="underline" style={{ color: "var(--accent)" }}>Register here</Link>
              </p>
            </div>
          </div>
        </section>

        {/* --------SCROLLING BANNER------- */}
        <div className="overflow-hidden py-3.5" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--bg2)", transition: "background .4s ease, border-color .4s ease" }}>
          <div className="flex gap-10 whitespace-nowrap scrollLoop">
            {[...scrollingBanner, ...scrollingBanner].map((t, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-3 mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
                <div className="w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />{t}
              </div>
            ))}
          </div>
        </div>

        {/* -----HOW IT WORKS----------*/}
        <section id="howSec" className="howOuter" style={{ background: "var(--bg)", transition: "background .4s ease" }}>
          <div className="max-w-[1400px] mx-auto text-center">
            <TagLine label="How it works" center />
            <h2 className="reveal playfair mb-3" style={{ fontSize: "clamp(2rem,3.8vw,3.6rem)", lineHeight: 1.12, letterSpacing: "-.02em" }}>
              Four steps,<br /><em style={{ fontStyle: "italic", color: "var(--accent)" }}>Publish to Verdict.</em>
            </h2>
            <p className="reveal mx-auto text-[15px] leading-[1.7] max-w-[500px]" style={{ color: "var(--muted)" }}>
              Each step connects to the next for the analyses.
            </p>
            <div className="howRow">
              {steps.map(step => (
                <React.Fragment key={step.id}>
                  <div className="stepNode" id={step.id}>
                    <div className="circleOuter">
                      <div className="circleInner">
                        <span className="stepWord">{step.word}</span>
                        <p className="stepText">{step.text}</p>
                      </div>
                    </div>
                  </div>
                  {step.arrowId && <StepArrow id={step.arrowId}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ----------PRIVACY---------*/}
        <section className="py-12 sm:py-16 px-5 sm:px-8 lg:px-12" style={{ background: "var(--bg2)", transition: "background .4s ease" }}>
          <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="revealLeft">
              <TagLine label="Privacy by Design"/>
              <h2 className="playfair mb-6" style={{ fontSize: "clamp(2rem,3.8vw,3.8rem)", lineHeight: 1.12, letterSpacing: "-.02em" }}>
                Fair review,<br /><em style={{ fontStyle: "italic", color: "var(--accent)" }}>no bias.</em>
              </h2>
              <p className="text-base leading-[1.8]" style={{ color: "var(--muted)" }}>
                The grading should be free from bias. Instructor comparison views never show student identities during analysis. Names, IDs and student email are only revealed after an instructor request.
              </p>
            </div>
            <div className="revealRight flex flex-col gap-4">
              {privacyFeatures.map(f => (
                <div key={f.title} className="flex items-start gap-4 p-4 rounded-lg"
                     style={{ background: "var(--card)", border: "1px solid var(--accent)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: "var(--accentDim)", border: "1px solid var(--accent)" }}>
                    <f.icon className="w-4 h-4" style={{ color: "var(--accent)" }}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{f.title}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------QUOTE------------ */}
        <div id="pxSec" className="relative flex items-center justify-center overflow-hidden" style={{ height: "75vh" }}>
          <div id="pxBg" className="absolute pointer-events-none"
               style={{ inset: "-20%", background: "radial-gradient(ellipse 50% 60% at 30% 40%,var(--accentGlow),transparent 65%),radial-gradient(ellipse 40% 50% at 70% 65%,var(--accentDim),transparent 65%)" }} />
          {floatingWords.map(w => (
            <div key={w.word} className="floatWord absolute mono text-[9px] tracking-[0.2em] uppercase pointer-events-none"
                 style={{ ...w.pos, color: "var(--accent)", opacity: .16 }} data-speed={w.speed}>{w.word}</div>
          ))}
          <div className="text-center relative z-10 max-w-[820px] px-8">
            <blockquote className="playfair leading-[1.32]" style={{ fontSize: "clamp(1.5rem,3vw,3rem)", fontStyle: "italic" }}>
              "We don't just detect plagiarism,<br />
              we protect the <strong style={{ fontStyle: "normal", color: "var(--accent)"}}>identity of every student</strong><br />
              without compromising fairness."
            </blockquote>
            <cite className="block mt-6 mono text-[9px] tracking-[0.2em] uppercase not-italic" style={{ color: "var(--muted)" }}>— Academic FBI's Core Belief</cite>
          </div>
        </div> 
        

        {/* ----------tEAM---------- */}
        <section className="py-16 sm:py-20 lg:py-28 px-5 sm:px-8 lg:px-12" style={{ background: "var(--bg2)", transition: "background .4s ease" }}>
          <div className="max-w-[1240px] mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16 items-end mb-10 lg:mb-14">
              <div>
                <TagLine label="Our Team" />
                <h2 className="playfair" style={{ fontSize: "clamp(2rem,3.8vw,3.8rem)", lineHeight: 1.12, letterSpacing: "-.02em" }}>
                  7 people.<br />
                  <em style={{ fontStyle: "italic", color: "var(--accent)" }}>One mission.</em>
                </h2>
              </div>
              <p className="text-base leading-[1.75]" style={{ color: "var(--muted)" }}>
                A core team of seven - developers, designers, and a leader who built this software for universities.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {team.map(member => <RoleCard key={member.title} {...member} />)}
            </div>
          </div>
        </section>

        {/* ------------ CTA --------- */}
        <section className="relative text-center py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-12 overflow-hidden" style={{ transition: "background .4s ease" }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%,var(--accentGlow),transparent 65%)" }} />
          <div className="relative max-w-[1240px] mx-auto">
            <TagLine label="Trusted Worldwide" center />
            <h2 className="reveal playfair" style={{ fontSize: "clamp(2.2rem,4.5vw,4.5rem)", lineHeight: 1.1 }}>
              Trusted by 50+ universities.<br />
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Is yours next?</em>
            </h2>
            <p className="reveal mx-auto mt-6 mb-10 text-base max-w-xl" style={{ color: "var(--muted)" }}>
              Reach out to learn how Academic FBI can integrate with your institution&apos;s workflow.
            </p>
            <div className="reveal flex flex-wrap justify-center gap-3 mb-10">
              {ctaBadges.map(({ icon: Icon, label }, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded text-sm"
                     style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--fg2)" }}>
                  <Icon size={16} className="text-orange-500 dark:text-cyan-400 shrink-0" />{label}
                </div>
              ))}
            </div>
            <div className="reveal flex justify-center gap-4">
              <button
                onClick={() => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 24px var(--accentGlow)" }}
              >
                Get Started
              </button>
              <Link href="/contact">
                <button className="px-8 py-3.5 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{ background: "transparent", border: "1px solid var(--borderS)", color: "var(--fg2)" }}>
                  Register Your University
                </button>
              </Link>
            </div>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  )
}
