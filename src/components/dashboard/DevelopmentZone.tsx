import { useNavigate } from 'react-router-dom'
import { BookOpen, Video, Users, Calendar, Lock, ArrowRight } from 'lucide-react'

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
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0E3047]">Min utveckling</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kunskap, mallar, live-sessioner och gemenskap
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-[#0E3047]" />
          <h3 className="font-semibold text-[#0E3047]">Kunskapsbibliotek</h3>
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
          <Video size={18} className="text-[#0E3047]" />
          <h3 className="font-semibold text-[#0E3047]">Nästa live-session</h3>
        </div>
        <div className="bg-[#F5F5F0] rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#0E3047]">{NEXT_SESSION.title}</p>
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
          <Users size={18} className="text-[#0E3047]" />
          <h3 className="font-semibold text-[#0E3047]">Entreprenörs-communityt</h3>
        </div>
        <p className="text-sm text-gray-600">
          Ställ frågor, dela erfarenheter och bygg nätverk med andra entreprenörer.
        </p>
        <p className="text-xs text-gray-400 mt-2">47 entreprenörer &middot; 12 aktiva trådar</p>
      </div>

      <div className="bg-gradient-to-br from-[#0E3047] to-[#1A4060] rounded-xl p-8 text-white text-center">
        <h2 className="text-xl font-bold mb-2">Entreprenörens Plattform</h2>
        <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
          Kunskapsbibliotek, kommenterade mallar, live-sessioner med John,
          och ett community av ambitiösa entreprenörer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/dashboard/utveckling/plattformen')}
            className="bg-white text-[#0E3047] px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            Bli medlem — 499 kr/mån
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/dashboard/utveckling/plattformen')}
            className="border border-white/30 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            Läs mer
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="bg-[#F5F5F0] rounded-lg p-6 text-center">
        <p className="text-sm font-semibold text-[#0E3047] mb-1">Inre Kretsen</p>
        <p className="text-xs text-gray-500 mb-3">
          Peer group-sessioner, 1:1-samtal med John och prioriterad support.
        </p>
        <button
          onClick={() => navigate('/dashboard/utveckling/inre-kretsen')}
          className="text-sm text-[#0E3047] font-medium hover:underline"
        >
          Läs mer om Inre Kretsen &rarr;
        </button>
      </div>
    </div>
  )
}
