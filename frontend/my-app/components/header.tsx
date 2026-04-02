"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Code2, Menu, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()

  const scrollToGetStarted = () => {
    if (pathname === "/") {
      document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })
    } else {
      router.push("/#get-started")
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">
            ACADEMIC<span className="text-primary">FBI</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/"
                className="group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
              >
                Home
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/services"
                className="group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
              >
                Services
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/contact"
                className="group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
              >
                Contact
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" className="hidden sm:flex text-sm" onClick={scrollToGetStarted}>
            Get Started
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>

          <ThemeToggle />

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Code2 className="h-6 w-6 text-primary" />
                  ACADEMIC<span className="text-primary">FBI</span>
                </SheetTitle>
              </SheetHeader>
              <Separator className="my-4" />
              <nav className="flex flex-col gap-4">
                <Link href="/" className="text-lg font-medium hover:text-primary transition-colors">
                  Home
                </Link>
                <Link href="/services" className="text-lg font-medium hover:text-primary transition-colors">
                  Services
                </Link>
                <Link href="/contact" className="text-lg font-medium hover:text-primary transition-colors">
                  Contact
                </Link>
                <Separator />
                <Button className="w-full" onClick={scrollToGetStarted}>
                  Get Started
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
