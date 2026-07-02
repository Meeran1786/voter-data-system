'use client'

export default function MdisFooter() {
  return (
    <footer className="bg-[#0f2460] text-white mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Left — logo + tagline */}
          <div className="flex items-center gap-3">
            <img
              src="https://maqsusi.com/wp-content/uploads/2025/10/cropped-Maqsusi-no-bg.png"
              alt="Maqsusi Digital Industries Software"
              className="h-8 w-auto object-contain brightness-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                Maqsusi Digital Industries Software
              </p>
              <p className="text-[11px] text-blue-200 leading-tight">
                Labyrinth Global Solutions India Private Limited
              </p>
            </div>
          </div>

          {/* Center — certifications */}
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 border border-white/20 rounded text-blue-100">
              CMMI Level 5
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 border border-white/20 rounded text-blue-100">
              ISO 9001:2015
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 border border-white/20 rounded text-blue-100">
              Siemens Partner
            </span>
          </div>

          {/* Right — links */}
          <div className="flex items-center gap-4 text-xs text-blue-200">
            <a href="https://www.maqsusi.com" target="_blank" rel="noopener noreferrer"
               className="hover:text-white transition-colors">
              www.maqsusi.com
            </a>
            <span className="text-white/20">|</span>
            <a href="https://www.maqsusi.com/contact-us/" target="_blank" rel="noopener noreferrer"
               className="hover:text-white transition-colors">
              Contact Us
            </a>
            <span className="text-white/20">|</span>
            <a href="https://www.linkedin.com/company/labyrinth-global-solutions/" target="_blank" rel="noopener noreferrer"
               className="hover:text-white transition-colors">
              LinkedIn
            </a>
          </div>
        </div>

        {/* Bottom rule */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-blue-300">
          <p>© {new Date().getFullYear()} Labyrinth Global Solutions India Private Limited. All rights reserved.</p>
          <p>Voter Data System · All data stored locally · No external connections</p>
        </div>
      </div>
    </footer>
  )
}
