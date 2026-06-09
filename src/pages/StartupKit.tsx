import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Rocket, Building2, ArrowRight, ArrowLeft, ExternalLink, CheckCircle2,
  FileText, Landmark, ShoppingBag, Sparkles, Phone,
} from 'lucide-react'

/**
 * Startup Kit — startflöde (2026-06-08).
 * Två vägar: "Starta från grunden" (grundhandlingar + verksamt.se-guide)
 * och "Köp lagerbolag" (bolagsratt.se + Johns hjälp). 1 490 kr, oförändrat.
 * Vägledning visas i appen; faktisk registrering/köp sker via extern länk.
 */

type Path = 'choose' | 'scratch' | 'shelf'

const VERKSAMT_URL = 'https://www.verksamt.se/starta/registrera-ditt-foretag'
const BOLAGSRATT_URL = 'https://www.bolagsratt.se/lagerbolag'
const BOKA_URL = 'https://johntengstrom.se/boka'

const FOUNDATION_DOCS = [
  { title: 'Stiftelseurkund', desc: 'Grunddokumentet som bildar bolaget och tecknar aktierna.' },
  { title: 'Bolagsordning', desc: 'Bolagets regelverk — verksamhetsföremål, aktiekapital, aktieslag.' },
  { title: 'Aktiebok', desc: 'Förteckning över aktieägare — obligatorisk från dag ett.' },
  { title: 'Konstituerande styrelseprotokoll', desc: 'Utser styrelse, firmatecknare och firmateckning.' },
]

const VERKSAMT_STEPS = [
  'Skaffa e-legitimation (BankID) till alla stiftare.',
  'Öppna ett företagskonto och sätt in aktiekapitalet (minst 25 000 kr).',
  'Begär bankintyg som styrker aktiekapitalet.',
  'Registrera bolaget hos Bolagsverket via verksamt.se och ladda upp handlingarna.',
  'Ansök om F-skatt och eventuell momsregistrering hos Skatteverket (samma tjänst).',
]

function PathCard({ icon: Icon, title, desc, badge, onClick }: {
  icon: typeof Rocket; title: string; desc: string; badge?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-[#E8E4DE] p-6 hover:border-[#0E3047]/40 hover:shadow-sm transition-all relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#0E3047]" />
      {badge && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(181,69,59,0.10)', color: '#B5453B' }}>
          {badge}
        </span>
      )}
      <Icon size={24} className="text-[#0E3047] mb-3" />
      <h3 className="font-semibold text-[#0E3047] mb-1">{title}</h3>
      <p className="text-sm text-[#4B6680]">{desc}</p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0E3047] mt-3">
        Välj <ArrowRight size={14} />
      </span>
    </button>
  )
}

function StepRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-[#0E3047] text-[#FAF6EE] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <p className="text-sm text-[#2D3436] leading-relaxed">{children}</p>
    </div>
  )
}

function ContractEngineCta({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="bg-[#0E3047] rounded-xl p-6 text-[#FAF6EE] flex items-center justify-between gap-4">
      <div>
        <h3 className="font-semibold mb-1">Nästa steg när bolaget är registrerat</h3>
        <p className="text-sm text-[#FAF6EE]/70">Ta fram aktieägaravtal och anställningsavtal i Avtalsmotorn.</p>
      </div>
      <button
        onClick={() => navigate('/dashboard/verktyg/avtal')}
        className="bg-[#B5453B] text-[#FAF6EE] px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9E3B32] transition-colors flex items-center gap-1.5 flex-shrink-0"
      >
        Till Avtalsmotorn
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

export function StartupKit() {
  const navigate = useNavigate()
  const [path, setPath] = useState<Path>('choose')

  if (path === 'choose') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Startup Kit</h1>
          <p className="text-[#4B6680] mt-1">
            Starta ditt bolag rätt från grunden. Välj hur du vill gå tillväga — vi guidar dig hela vägen.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PathCard
            icon={Rocket}
            title="Starta från grunden"
            desc="Vi tar fram dina grundhandlingar och guidar dig genom registreringen på verksamt.se."
            badge="Populär"
            onClick={() => setPath('scratch')}
          />
          <PathCard
            icon={Building2}
            title="Köp ett lagerbolag"
            desc="Snabbaste vägen till ett färdigt aktiebolag. Vi hjälper dig köpa via Bolagsrätt Sundsvall."
            onClick={() => setPath('shelf')}
          />
        </div>

        <div className="bg-[#F5F5F0] rounded-xl p-5 flex items-start gap-3">
          <Sparkles size={18} className="text-[#B5453B] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#4B6680]">
            Startup Kit kostar <span className="font-medium text-[#0E3047]">1 490 kr</span> och inkluderar
            framtagning av grundhandlingar, en 90-dagarsplan och Johns perspektiv genom hela processen.
          </p>
        </div>
      </div>
    )
  }

  if (path === 'scratch') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setPath('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0E3047]">
          <ArrowLeft size={15} /> Tillbaka till vägval
        </button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Starta från grunden</h1>
          <p className="text-[#4B6680] mt-1">Bilda ett nytt aktiebolag — handlingar och registrering steg för steg.</p>
        </div>

        <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-[#0E3047]" />
            <h2 className="font-semibold text-[#0E3047]">1. Dina grundhandlingar</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FOUNDATION_DOCS.map((d) => (
              <div key={d.title} className="rounded-lg bg-[#FAFAF8] border border-[#E8E4DE] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={15} className="text-[#3A5A40]" />
                  <h3 className="text-sm font-medium text-[#0E3047]">{d.title}</h3>
                </div>
                <p className="text-xs text-[#4B6680]">{d.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#4B6680] mt-4">
            Handlingarna genereras utifrån dina uppgifter och Johns perspektiv. Avtalsmotorn kompletterar
            med aktieägaravtal och anställningsavtal när bolaget är registrerat.
          </p>
        </section>

        <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Landmark size={18} className="text-[#0E3047]" />
            <h2 className="font-semibold text-[#0E3047]">2. Registrera på verksamt.se</h2>
          </div>
          <div className="space-y-3">
            {VERKSAMT_STEPS.map((s, i) => <StepRow key={i} n={i + 1}>{s}</StepRow>)}
          </div>
          <a
            href={VERKSAMT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 bg-[#0E3047] text-[#FAF6EE] px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
          >
            Öppna verksamt.se
            <ExternalLink size={14} />
          </a>
        </section>

        <ContractEngineCta navigate={navigate} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => setPath('choose')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0E3047]">
        <ArrowLeft size={15} /> Tillbaka till vägval
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Köp ett lagerbolag</h1>
        <p className="text-[#4B6680] mt-1">Ett färdigregistrerat aktiebolag som är klart att använda direkt.</p>
      </div>

      <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag size={18} className="text-[#0E3047]" />
          <h2 className="font-semibold text-[#0E3047]">När passar ett lagerbolag?</h2>
        </div>
        <p className="text-sm text-[#2D3436] leading-relaxed">
          Ett lagerbolag är ett vilande, färdigregistrerat aktiebolag med organisationsnummer och inbetalt
          aktiekapital. Det passar när du behöver komma igång snabbt — du kan teckna avtal och fakturera samma
          dag, istället för att vänta på Bolagsverkets handläggning. Efter köpet byter du namn, styrelse och
          verksamhetsföremål.
        </p>
      </section>

      <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} className="text-[#0E3047]" />
          <h2 className="font-semibold text-[#0E3047]">Så går det till</h2>
        </div>
        <div className="space-y-3">
          <StepRow n={1}>Vi hjälper dig välja och beställa ett lagerbolag via Bolagsrätt Sundsvall.</StepRow>
          <StepRow n={2}>Du tillträder bolaget och vi tar fram tillträdeshandlingar och nytt styrelseprotokoll.</StepRow>
          <StepRow n={3}>Vi anmäler ändringarna (namn, styrelse, bolagsordning) till Bolagsverket.</StepRow>
          <StepRow n={4}>Bolaget är klart att använda — Avtalsmotorn och Health Check tar vid.</StepRow>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <a
            href={BOLAGSRATT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#0E3047] text-[#FAF6EE] px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
          >
            Se lagerbolag hos Bolagsrätt
            <ExternalLink size={14} />
          </a>
          <a
            href={BOKA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white border border-[#E8E4DE] text-[#0E3047] px-4 py-2.5 rounded-lg text-sm font-medium hover:border-[#0E3047]/40 transition-colors"
          >
            <Phone size={14} />
            Få Johns hjälp
          </a>
        </div>
      </section>
    </div>
  )
}
