import { Github, Globe, MessageSquare, ExternalLink, ShieldCheck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="shrink-0 border-t border-slate-800/40 bg-[#0B1120]/95 px-4 py-2.5 backdrop-blur-2xl z-30">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-500 font-black text-slate-950 text-[8px] shadow-[0_0_8px_rgba(251,191,36,0.2)]">
            B
          </div>
          <span className="font-bold text-slate-400 tracking-tight">
            BGMI <span className="text-amber-400/80">Tactical Analyzer</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-bold text-emerald-400/80">
            <ShieldCheck size={9} /> Esports
          </span>
        </div>

        {/* Center: Attribution */}
        <div className="flex items-center gap-1.5 text-center text-[11px]">
          <span className="text-slate-600">Built by</span>
          <span className="font-bold text-slate-300">Ashitosh Biradar</span>
          <span className="text-slate-700">·</span>
          <span className="font-medium text-slate-500">Developer & Strategist</span>
        </div>

        {/* Right: Links */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ashitoshbiradar19"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-200"
            title="GitHub"
          >
            <Github size={12} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="https://discord.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-200"
            title="Discord"
          >
            <MessageSquare size={12} />
            <span className="hidden sm:inline">Discord</span>
          </a>
          <a
            href="https://ashitoshbiradar19.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-200"
            title="Portfolio"
          >
            <Globe size={12} />
            <span className="hidden sm:inline">Portfolio</span>
            <ExternalLink size={9} className="opacity-40" />
          </a>
        </div>
      </div>
    </footer>
  )
}
