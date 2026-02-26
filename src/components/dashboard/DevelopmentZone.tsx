import { BookOpen, Video, Users, Calendar, Lock, ArrowRight, ExternalLink } from 'lucide-react'

const PREVIEW_ARTICLES = [
  { title: 'Aktiebolag eller enskild firma — vad passar dig?', tag: 'Starta' },
  { title: '5 vanligaste misstagen vid bolagsbildning', tag: 'Starta' },
  { title: 'Så förbereder du ditt bolag för investerare', tag: 'Växa' },
]

const NEXT_SESSION = {
  title: 'Q&A: Bolagsordningens hemliga kraft',
  date: '2026-03-15',
  time: '12:00',
}

export function DevelopmentZone() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#2D3436]">Min utveckling</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kunskap, mallar, live-sessioner och gemenskap
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-[#2D3436]" />
          <h3 className="font-semibold text-[#2D3436]">Kunskapsbibliotek</h3>
          <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium ml-auto">
            Kommer snart
          </span>
        </div>
        <div className="space-y-3">
          {PREVIEW_ARTICLES.map((article, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm text-gray-700">{article.title}</p>
                <span className="text-xs text-gray-400">{article.tag}</span>
              </div>
              <Lock size={14} className="text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Video size={18} className="text-[#2D3436]" />
          <h3 className="font-semibold text-[#2D3436]">Nästa live-session</h3>
        </div>
        <div className="bg-[#F5F5F0] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#2D3436]">{NEXT_SESSION.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              <Calendar size={12} className="inline mr-1" />
              {new Date(NEXT_SESSION.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' kl '}{NEXT_SESSION.time}
            </p>
          </div>
          <Lock size={16} className="text-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#2D3436]" />
          <h3 className="font-semibold text-[#2D3436]">Entreprenörs-communityt</h3>
        </div>
        <p className="text-sm text-gray-600">
          Ställ frågor, dela erfarenheter och bygg nätverk med andra entreprenörer.
        </p>
        <p className="text-xs text-gray-400 mt-2">47 entreprenörer &middot; 12 aktiva trådar</p>
      </div>

      <div className="bg-gradient-to-br from-[#2D3436] to-[#3d4446] rounded-xl p-8 text-white text-center">
        <h2 className="text-xl font-bold mb-2">Entreprenörens Plattform</h2>
        <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
          Kunskapsbibliotek, kommenterade mallar, live-sessioner med John,
          och ett community av ambitiösa entreprenörer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="bg-white text-[#2D3436] px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            Bli medlem — 499 kr/mån
            <ArrowRight size={16} />
          </button>
          <a
            href="https://johntengstrom.se/plattformen"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/30 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            Läs mer
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="bg-[#F5F5F0] rounded-lg p-6 text-center">
        <p className="text-sm font-semibold text-[#2D3436] mb-1">Inre Kretsen</p>
        <p className="text-xs text-gray-500 mb-3">
          Peer group-sessioner, 1:1-samtal med John och prioriterad support.
        </p>
        <a
          href="https://johntengstrom.se/inre-kretsen"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#2D3436] font-medium hover:underline"
        >
          Läs mer om Inre Kretsen &rarr;
        </a>
      </div>
    </div>
  )
}
