"use client"

import * as React from "react"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GraduationCap, User, Users, CalendarDays, ArrowRight } from "lucide-react"


export default function AdminSidebar() {
  return (
    <>
    <Header/>
     <div className="flex min-h-screen">
    <aside className="w-50 border-r px-6 py-6">
      <nav className="space-y-2">

        {/* Courses*/}
        <Button
          asChild
          variant="ghost"
          className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground hover:bg-accent/80">
          <Link href="/admin">
            <GraduationCap className="h-6 w-6 text-primary" />
            Courses
          </Link>
        </Button>

        {/* Instructors */}
        <Button
          asChild
          variant="ghost"
          className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground hover:bg-accent/80"
        >
          <Link href="/admin/Employee">
            <Users className="h-6 w-6 text-primary" />
            Instructors
          </Link>
        </Button>

      </nav>
    </aside>
    {/* RIGHT CONTENT */}
    
    <main className="flex-auto">
        
        <CourseDisplay />
        </main>
        </div>

        <Footer/>
    </>
    
  )
}

export function CourseDisplay() {
     const router = useRouter()

    const courses = [
  { id: "math-1p02", code: "MATH 1P02", title: "Introduction to Mathematics", instructor: "Sarah Smith", term: "Winter 2026" },
  { id: "math-1p03", code: "MATH 1P03", title: "Basic Calculus", instructor: "Chen Li", term: "Winter 2026" },
  { id: "math-2p03", code: "MATH 2P02", title: "Math History", instructor: "Sarah Smith", term: "Winter 2026" },
  { id: "math-2f03", code: "MATH 2F03", title: "Linear Algebra", instructor: "Chen Li", term: "Full year 205-2026" },
  { id: "cosc-1p02", code: "COSC 1P02", title: "Introduction to CompSci", instructor: "James Bond", term: "Winter 2026" },
  { id: "sosc-1p03", code: "COSC 1P03", title: "Data Structures", instructor: "Alan parker", term: "Winter 2026" },
  { id: "cosc-2f94", code: "COSC 2F94", title: "Project course", instructor: "James Bond", term: "Full year 2025-2026" },
  { id: "cosc-2p96", code: "COSC 2P96", title: "Databases", instructor: "Alan parker", term: "Winter 2026" },

]

return (
  <div className="flex-1 p-8">
    {/* Title and text */}
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-foreground">Courses currently offered by your University </h1>
      <p className="mt-2 text-muted-foreground">
        Click a course to view assignments and submissions.
      </p>
    </div>

    {/* Grid*/}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((courseslist) => (
        <Card
          key={courseslist.id}
          className=" cursor-pointer border-orange-500/70 dark:border-cyan-400/70
           text-card-foreground  shadow-[0_10px_25px_rgba(0,0,0,0.60)] dark:shadow-[0_10px_25px_rgba(225,225,225,0.16)]
           hover:shadow-[0_0_28px_rgba(249,115,22,0.65)] dark:hover:shadow-[0_0_28px_rgba(34,211,238,0.65)]"
          onClick={() => {
            router.push(``)
          }
        }
        >
          <CardContent className="p-5">
            
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-primary">
                  {courseslist.code}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {courseslist.title}
                </div>
              </div>

             
            </div>

           {/* Name and term */}
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span>{courseslist.instructor}</span>
              </div>

              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <span>{courseslist.term}</span>
              </div>
            </div>

            {/* Bottom glow line like your mock */}
            <div className="mt-5 h-[2px] w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
          </CardContent>
        </Card>
      )
      )
      }
    </div>
  </div>
    )
}