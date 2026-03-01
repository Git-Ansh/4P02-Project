"use client"

import { useRouter } from "next/navigation"
import { School, Landmark, FileUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RoleSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  universitySlug: string
}

export function RoleSelectionDialog({ open, onOpenChange, universitySlug }: RoleSelectionDialogProps) {
  const router = useRouter()

  const handleRoleSelect = (role: string) => {
    onOpenChange(false)
    router.push(`/login?university=${encodeURIComponent(universitySlug)}&role=${role}`)
  }

  const handleSubmitAssignment = () => {
    onOpenChange(false)
    router.push(`/submit?university=${encodeURIComponent(universitySlug)}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Select Your Role</DialogTitle>
          <DialogDescription className="text-center">
            Choose how you want to access the system
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 pt-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleRoleSelect("admin")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Landmark className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Administrator</CardTitle>
                <CardDescription>Manage institutions and users</CardDescription>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleRoleSelect("instructor")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <School className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Instructor</CardTitle>
                <CardDescription>Create courses and review submissions</CardDescription>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={handleSubmitAssignment}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Submit Assignment</CardTitle>
                <CardDescription>Submit your code files with a token</CardDescription>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
