"use client"

import { School, Landmark } from "lucide-react"
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
}

export function RoleSelectionDialog({ open, onOpenChange }: RoleSelectionDialogProps) {
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
          <Card className="cursor-pointer hover:border-primary transition-colors">
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
          <Card className="cursor-pointer hover:border-primary transition-colors">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
