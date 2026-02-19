"use client"

import * as React from "react"
import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { Footer } from "@/components/footer"
import { RoleSelectionDialog } from "@/components/role-selection-dialog"
import { TronGridBackground } from "@/components/tron-grid-background"

export default function Page() {
  const [openContinueModal, setOpenContinueModal] = React.useState(false)
  const [selectedUni, setSelectedUni] = React.useState("")

  return (
    <div className="min-h-screen flex flex-col">
      <TronGridBackground />

      <Header />

      <main className="flex-1 relative w-full flex flex-col items-center">
        <HeroSection
          selectedUni={selectedUni}
          onSelectUni={setSelectedUni}
          onContinue={() => setOpenContinueModal(true)}
        />
        <FeaturesSection />
      </main>

      <RoleSelectionDialog
        open={openContinueModal}
        onOpenChange={setOpenContinueModal}
        universitySlug={selectedUni}
      />

      <Footer />
    </div>
  )
}
