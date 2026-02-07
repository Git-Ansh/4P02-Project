import Link from "next/link"

export default function Footer() {
return(
<footer className="w-full bg-indigo-500 border-b shadow">
  <div className="mx-auto max-w-7xl px-1 py-2">

    <div className="grid grid-cols-1 md:grid-cols-2 gap-9">

      {/* About */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">About</h3>
        <ul className="space-y-2 text-white">
            <li>
          <Link href="" className="text-white hover:text-black">Home</Link>
          </li>

          <li>
            <Link href="" className="text-white hover:text-black">Contact Us</Link>
          </li>

          <li>
            <Link href=""className="text-white hover:text-black">About Us</Link>
          </li>
        </ul>
      </div>

      

      {/* Company name & description */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">
          Academic FBI
        </h3>
        <p className="text-sm leading-relaxed text-white">
          Trusted by 10k+ institution for the detection of plagarism. Designed to help university to access
          originality while maintaing confidentiality. Built with security,privacy and institutional standards in mind.
        </p>
      </div>
    </div>

    {/* Bottom line */}
    <p className="mt-8 text-center text-sm text-white">
      Academic FBI © 2026
    </p>

  </div>
</footer>
)
}
