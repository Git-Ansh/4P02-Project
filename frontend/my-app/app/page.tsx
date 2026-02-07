  "use client"
  import * as React from "react"
  import Link from "next/link"
  import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuLink,
  } from "@/components/ui/navigation-menu"

  import { Button } from "@/components/ui/button"

  import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"

  import Footer from "@/app/Footer-folder/Footer"

  import { School2Icon,ShieldCheckIcon,LaptopMinimalCheckIcon,LandmarkIcon } from 'lucide-react';

  import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


  export default function Page() {
    const [Uniselected, setUniselected] = React.useState("")
    const [openContinueModal, setContinueModal] = React.useState(false)

    {/*Nav bar */}
    return (
      <>
      <div className="w-full bg-indigo-500 border-b shadow">
      <NavigationMenu className="w-full border-b  px-5 py-3">
      
        <NavigationMenuList className="flex gap-20">
          <NavigationMenuItem>
            <NavigationMenuLink href="#" className="text-xl font-semibold tracking-widest uppercase text-white
            hover:bg-transparent focus:bg-transparent after:left-0 after:bottom-1 after:h-[2px] after:w-[0px] after:bg-black hover:after:w-full">
              Home
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink href="#"className="text-xl font-semibold tracking-widest uppercase text-white
            hover:bg-transparent focus:bg-transparent after:left-0 after:bottom-1 after:h-[2px] after:w-[0px] after:bg-black hover:after:w-full">
              About Us
            </NavigationMenuLink>
          </NavigationMenuItem>
          
          <NavigationMenuItem>
            <NavigationMenuLink href="#" className="text-xl font-semibold tracking-widest uppercase text-white
            hover:bg-transparent focus:bg-transparent after:left-0 after:bottom-1 after:h-[2px] after:w-[0px] after:bg-black hover:after:w-full">
            Contact Us
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      </div>

    
      
      {/* Body text top with bg waves*/}
        <main className="relative flex flex-col items-center py-32">

            <img
            src="/img/svgviewer-output.svg"
            className="pointer-events-none absolute inset-0  h-full w-full object-cover"
            />

          <div className=" relative  flex flex-col items-center gap-9">
          <h1 className="text-2xl font-semi-bold  text-indigo-700 uppercase">Select your institution</h1>
          <p className="mt-1 text-base text-slate-600 md:text-lg">Choose your university to access our secure plagirism detection software</p>
          </div>
        
      {/* Selection drop down with icon */}
     <div className="mt-10 w-full  max-w-3xl rounded-2xl bg-white px-4 py-10 shadow-xl ring-2 ring-slate-100 shadow-blur">
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
      
      <div className="flex flex-1 items-center gap-3  px-9">
        <School2Icon className="h-9 w-5 text-indigo-500" />
        <div className="flex-1">
          <UniMenu value={Uniselected} onChange={setUniselected}  />
        </div>
      </div>   

      {/* Continue button */}
      <Button disabled={!Uniselected} onClick={() => setContinueModal(true)} className="h-12 rounded-none bg-indigo-500 px-10 text-base font-semibold text-white hover:bg-indigo-900 hover:shadow-xl">
        Continue
      </Button>
    </div>
  </div>

      {/* 3icons and text */}

      <div className="mt-8 flex justify-center gap-10 text-center">

        <div className="flex items-center gap-2">
         <ShieldCheckIcon className="h-6 w-9 text-indigo-600" />
         <span className="text-md font-md">Secure & Private</span>
         </div>

        <div className="flex items-center gap-2">
         <LaptopMinimalCheckIcon className="h-6 w-9 text-indigo-600" />
         <span className="text-md font-md">Similarity Detaction</span>
        </div>

        <div className="flex items-center gap-2">
         <LandmarkIcon className="h-6 w-9 text-indigo-600" />
         <span className="text-md font-md">Managed Access</span>
        </div>
      </div>
     
         {/* Register */}
          <p className="mt-8 font-sm text-md text-center text-gray-600 ">
            Can't find your institution?
          </p>
          <Link href=""className="mt-3 font-sm text-md text-center text-indigo-600 hover:text-indigo-900">Register here</Link>
        </main>

        <DialogModalofContinue open={openContinueModal}setOpen={setContinueModal} />

        {/* Footer */}
        <Footer/>
        </>
    )
      
  }

  function UniMenu({ value, onChange }: any) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 w-full border-0 bg-transparent px-0 text-left shadow-none focus:ring-0 focus:ring-offset-0">
          <SelectValue placeholder="Please select your university" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="w-full">Please select your university</SelectLabel>
            <SelectItem value="Brock">Brock University</SelectItem>
            <SelectItem value="Toronto">University of Toronto</SelectItem>
            <SelectItem value="York">York University</SelectItem>
            <SelectItem value="BC">University of British Columbia</SelectItem>
            <SelectItem value="Macgill">MacGill University</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )

  }


   function DialogModalofContinue({ open, setOpen }: any) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && (
      <div className="fixed inset-0  bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}/>
       )}
       
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Who is acessing the software?</DialogTitle>           
          </DialogHeader>   
     
     <div className="mt-5 grid gap-3">
      {/* Admin */}
      <button className="w-full rounded-xl bg-indigo-500 py-3 text-md font-semibold text-white hover:bg-indigo-900">
        Admin
      </button>

      {/* Instructor */}
      <button className="w-full rounded-xl bg-indigo-500 py-3 text-md font-semibold text-white hover:bg-indigo-900">
        Instructor
      </button>
    </div>
  </DialogContent>
    </Dialog>
  )
}


