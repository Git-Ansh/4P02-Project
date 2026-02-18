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
import { GraduationCap, User, Users, CalendarDays, SearchIcon, NotebookIcon } from "lucide-react"


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
          <Link href="/Instructor">
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
          <Link href="">
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
  { id: "math-1p02", code: "MATH 1P02", title: "Introduction to Mathematics", instructor: "Sarah Smith", term: "Winter 2026" ,students:"100", currentassi:"3" },
  { id: "math-2p03", code: "MATH 2P02", title: "Math History", instructor: "Sarah Smith", term: "Winter 2026" ,students:"50" , currentassi:"5" },
  { id: "math-1f02", code: "MATH 1F02", title: "Introduction to Mathematics", instructor: "Sarah Smith", term: "2025-2026",students:"80" , currentassi:"2"  },
  { id: "math-2p06", code: "MATH 2P05", title: "Math History", instructor: "Sarah Smith", term: "Winter 2026" ,students:"120", currentassi:"1"  },
  ]

return (
        <div className="flex-1 p-8">

      {/* Welcome*/}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            Hello, Prof. Smith 
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here is an overview of your courses and assignments.
          </p>
        </div>

        <Button className="bg-primary hover:bg-primary/90">
          + Add Course
        </Button>
      </div>

      {/* Staus Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-10">
        <Card className="border-primary/40 bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span>Total Courses</span>
            </div>
            <div className="mt-4 text-3xl font-bold">4</div>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="h-6 w-6 text-primary" />
              <span>Total Assignments</span>
            </div>
            <div className="mt-4 text-3xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

       {/*Filter */}
      <div className="flex items-center justify-between mb-4">
        <div>
        <h2 className="text-3xl font-bold">Your Courses</h2>
              <p className="mt-2 text-muted-foreground">
        Click a course to view assignments and submissions.
      </p>
      </div>

        <select className="bg-card border border-border rounded-md px-3 py-2 text-sm">
          <option>Winter 2026</option>
          <option>Full Year 2025-2026</option>
        </select>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-border border-orange-400/40 dark:border-cyan-500 bg-card px-3 py-2">
        < SearchIcon />
        <input 
          type="text"
          placeholder="Search courses..."
          className="w-full bg-card px-4 py-2 text-sm outline-none focus:outline-none focus:ring-0"
        />
      </div>




  <div className="flex-1 p-8">

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

            {/* Bottom line*/}
            <div className="mt-5 h-[2px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-40 transition group-hover:opacity-100" />


            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className ="text-muted-foreground">{courseslist.students} Students</span>
              </div>

            <div className="flex items-center gap-2">
                <NotebookIcon className="h-5 w-5 text-muted-foreground" />
                <span className ="text-muted-foreground">{courseslist.currentassi} Assignment posted</span>
              </div>
            
          </CardContent>
        </Card>
      )
      )
      }
    </div>
  </div>
  </div>
    )
}