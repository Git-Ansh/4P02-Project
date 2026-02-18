"use client"

import { Laptop, ShieldCheck, GraduationCap } from "lucide-react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function FeaturesSection() {
  return (
    <section className="pb-12 md:pb-24 w-full flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:border-primary">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mb-2">Secure & Private</CardTitle>
                  <CardDescription>
                    FIPPA-compliant data handling with end-to-end encryption
                  </CardDescription>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enterprise-grade security</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:border-primary">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <Laptop className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mb-2">Similarity Detection</CardTitle>
                  <CardDescription>
                    Advanced algorithms detecting code plagiarism with precision
                  </CardDescription>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI-powered analysis</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:border-primary">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mb-2">Institutional Access</CardTitle>
                  <CardDescription>
                    Role-based access control for admins and instructors
                  </CardDescription>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Multi-level permissions</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </section>
  )
}
