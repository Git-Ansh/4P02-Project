"use client"

import * as React from "react"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { GraduationCap, Users, Trash2Icon} from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
        
        <TableDemo />
        </main>
        </div>

        <Footer/>
    </>
    
  )
}

const invoices = [
  {
    name: "Sara Smith",
    email: "sm@xyz",
    department: "Mathematics",
    NumofCourses: "2",
    icon:"",
  },
  {
    name: "Chen Li",
    email: "cl@xyz",
    department: "Mathematics",
    NumofCourses: "2",
    icon:"",
  },
  {
    name: "James Bond",
    email: "jb@xyz",
    department: "Computer Science",
    NumofCourses: "2",
    icon:"",
  },
  {
    name: "Alan Parker",
    email: "ap@xyz",
    department: "Computer Science",
    NumofCourses: "3",
    icon:"",
  },
  {
    name: "Ingrid Ven",
    email: "iv@xyz",
    department: "Geology",
    NumofCourses: "5",
    icon:"",
  },
  {
    name: "Nicky Wood",
    email: "nw@xyz",
    department: "Engineering",
    NumofCourses: "4",
    icon:"",
  },
  {
    name: "Kim Evans",
    email: "ke@xyz",
    department: "Biology",
    NumofCourses: "1",
    icon:"",
  },
]

export function TableDemo() {

      const [rows, setRows] = React.useState(invoices)
       const deletion = (name: string) => {
    setRows((prev) => prev.filter((r) => r.name !== name))}
    

    {/* The below commented code deletes instructor even after page refreshes */}

      {/*
    const STORAGE_KEY = "instructors"

  const [rows, setRows] = React.useState<typeof invoices>([])

  // load on first mount
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    setRows(saved ? JSON.parse(saved) : invoices)
  }, [])

  // save whenever rows changes
  React.useEffect(() => {
    if (rows.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  }, [rows])

  const handleDelete = (name: string) => {
    setRows((prev) => prev.filter((r) => r.name !== name))
  }
  */}

  return (
    <>
    <Card className="border-none shadow-none bg-transparent">



    <CardContent className="p-6">
        <div className="overflow-hidden rounded-2xl
        border border-border border-orange-500 dark:border-cyan-400/40
        bg-card/40 backdrop-blur-xl
        shadow-[0_10px_30px_rgba(0,0,0,0.58)]
        dark:shadow-[0_18px_55px_rgba(0,0,0,0.55)]">
    <Table>
      <TableHeader>
        <TableRow className="bg-orange-500/80 dark:bg-cyan-400/40 hover:bg-orange-500/80 dark:hover:bg-cyan-400/40">
          <TableHead className="w-[100px] w-1/4">Name</TableHead>
          <TableHead className="w-1/5">Email</TableHead>
          <TableHead className="w-1/5">Department</TableHead>
          <TableHead className="w-1/5">Num of Courses</TableHead>
          <TableHead className="w-1/4">Delete</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((invoice) => (
          <TableRow key={invoice.name} className="
                odd:bg-muted/20
                transition-colors border-orange-500/20 dark:border-cyan-500/20
                hover:bg-orange-500/5 dark:hover:bg-cyan-500/10">
            <TableCell className="font-medium">{invoice.name}</TableCell>
            <TableCell>{invoice.email}</TableCell>
            <TableCell>{invoice.department}</TableCell>
            <TableCell>{invoice.NumofCourses}</TableCell>
            <TableCell>
                <AlertDialog>
         <AlertDialogTrigger asChild>
        <button type="button" className="p-2 rounded-md hover:bg-muted/40 transition" aria-label={`Delete ${invoice.name}`}>
    <Trash2Icon className="h-4 w-4" />
    </button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove <span className="font-medium">"{invoice.name}"</span> as instructor?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the instructor account
        from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => deletion(invoice.name)}>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
    </CardContent>
    </Card>
    </>
  )
}