"use client"

import * as React from "react"
import Link from "next/link"
import { School, Zap, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"

interface HeroSectionProps {
  onContinue: () => void
}

export function HeroSection({ onContinue }: HeroSectionProps) {
  const [selectedUni, setSelectedUni] = React.useState("")

  return (
    <section className="relative flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="mx-auto max-w-4xl w-full text-center flex flex-col items-center justify-center">
          {/* Badge */}
          <div className="flex justify-center w-full mb-6">
            <Badge variant="outline" className="px-4 py-2 animated-border inline-flex">
              <Zap className="mr-2 h-4 w-4 text-primary" />
              Trusted by 50+ Universities
            </Badge>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-center">
            <span className="block">Secure Academic</span>
            <span className="block text-primary neon-text">Code Analysis</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-center">
            Advanced plagiarism detection for academic institutions.
            Protecting academic integrity with cutting-edge technology.
          </p>

          {/* University Selection Card */}
          <Card className="w-full max-w-xl mb-16 float-animation mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Select Your Institution</CardTitle>
              <CardDescription>
                Choose your university to access the secure plagiarism detection platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="university" className="sr-only">University</Label>
                  <Select value={selectedUni} onValueChange={setSelectedUni}>
                    <SelectTrigger id="university" className="w-full">
                      <School className="mr-2 h-4 w-4 text-primary" />
                      <SelectValue placeholder="Select your university" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Canadian Universities</SelectLabel>
                        <SelectItem value="brock">Brock University</SelectItem>
                        <SelectItem value="toronto">University of Toronto</SelectItem>
                        <SelectItem value="york">York University</SelectItem>
                        <SelectItem value="ubc">University of British Columbia</SelectItem>
                        <SelectItem value="mcgill">McGill University</SelectItem>
                        <SelectItem value="waterloo">University of Waterloo</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      disabled={!selectedUni}
                      onClick={onContinue}
                      className="w-full sm:w-auto"
                    >
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select a university to continue</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                Can&apos;t find your institution?{" "}
                <Link href="#" className="text-primary hover:underline font-medium">
                  Register here
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
