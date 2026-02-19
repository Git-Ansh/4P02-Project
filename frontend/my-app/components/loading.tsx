"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  text?: string
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
}

export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-[#00D9FF]/20" />
        
        {/* Spinning arc */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00D9FF] animate-spin" 
          style={{ animationDuration: '1s' }}
        />
        
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full border border-[#00D9FF]/30 animate-pulse" />
        
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#00D9FF] shadow-[0_0_10px_#00D9FF] animate-pulse" />
        </div>
      </div>
      
      {text && (
        <p className="text-[#00D9FF] text-sm font-medium tracking-wider animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

interface LoadingPageProps {
  text?: string
}

export function LoadingPage({ text = "LOADING..." }: LoadingPageProps) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      {/* Background grid */}
      <div className="absolute inset-0 tron-grid opacity-30" />
      
      {/* Loading content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo animation */}
        <div className="relative">
          <div className="text-4xl font-bold tracking-wider">
            <span className="text-white">ACADEMIC</span>
            <span className="text-[#00D9FF]">FBI</span>
          </div>
          <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00D9FF] to-transparent animate-pulse" />
        </div>
        
        {/* Spinner */}
        <LoadingSpinner size="lg" />
        
        {/* Loading text with typing effect */}
        <div className="h-6">
          <p className="text-[#00D9FF]/80 text-sm font-medium tracking-[0.3em] uppercase">
            {text}
          </p>
        </div>
        
        {/* Progress bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D9FF]/50 via-[#00D9FF] to-[#00D9FF]/50 animate-loading-bar" />
        </div>
      </div>
    </div>
  )
}

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse bg-white/5 rounded", className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-8 space-y-4">
      <Skeleton className="h-14 w-14 rounded-xl" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
