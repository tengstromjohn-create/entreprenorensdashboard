import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ExternalLink, Calendar } from 'lucide-react'

/**
 * Medlemskapssidor — interna landningssidor på grundat.ai (2026-06-08).
 * Innehållet är kopierat från johntengstrom.se/plattformen och /inre-kretsen.
 * Primär CTA länkar vidare till Kajabi-checkout; sekundär till bokning.
 *
 * OBS: checkout-URL:erna nedan är platshållare i samma mönster som Startup Kit
 * (johntengstrom.se/checkout/...). Bekräfta de faktiska Kajabi-länkarna.
 */

const CHECKOUT = {
  plattformen: 'https://johntengstrom.se/checkout/plattformen',
  inreKrets: 'https://johntengstrom.se/checkout/inre-kretsen',
}
const BOKA_URL = 'https://johntengstrom.se/boka'

interface PriceTier {
  amount: string
  period: string
  note: string
}

interface MembershipData {
  eyebrow: string
  title: string
  lead: string
  includes: string[]
  prices: PriceTier[]
  perk?: string
  forWho?: { title: string; body: string }
  ctaLabel: string
  checkoutUrl: string
}

function MembershipLanding({ data }: { data: MembershipData }) {
  const navigate = useNavigate()
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard/utveckling')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0E3047]"
      >
        <ArrowLeft size={15} /> Min utveckling
      </button>

      {/* Hero */}
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#B5453B] uppercase">{data.eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0E3047] mt-1">{data.title}</h1>
        <div className="mt-2 flex items-center gap-2" aria-hidden="true">
          <span className="h-[3px] w-12 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-1 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-3 bg-[#B5453B]/50 rounded-sm" />
        </div>
        <p className="text-[#4B6680] mt-3">{data.lead}</p>
      </div>

      {/* Vad ingår */}
      <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
        <h2 className="font-semibold text-[#0E3047] mb-4">Vad ingår</h2>
        <ul className="space-y-3">
          {data.includes.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-[#3A5A40]/10 flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-[#3A5A40]" />
              </span>
              <span className="text-sm text-[#2D3436] leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* För vem (om angivet) */}
      {data.forWho && (
        <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
          <h2 className="font-semibold text-[#0E3047] mb-2">{data.forWho.title}</h2>
          <p className="text-sm text-[#4B6680] leading-relaxed">{data.forWho.body}</p>
        </section>
      )}

      {/* Prissättning */}
      <section className="bg-white rounded-xl border border-[#E8E4DE] p-6">
        <h2 className="font-semibold text-[#0E3047] mb-4">Prissättning</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.prices.map((p, i) => (
            <div key={i} className="rounded-lg bg-[#FAFAF8] border border-[#E8E4DE] p-4">
              <p className="text-xl font-bold text-[#0E3047]">
                {p.amount} <span className="text-sm font-normal text-[#4B6680]">{p.period}</span>
              </p>
              <p className="text-xs text-[#4B6680] mt-1">{p.note}</p>
            </div>
          ))}
        </div>
        {data.perk && (
          <p className="text-sm text-[#3A5A40] mt-4 bg-[#3A5A40]/8 rounded-lg px-3 py-2">{data.perk}</p>
        )}
      </section>

      {/* CTA → Kajabi */}
      <div className="bg-[#0E3047] rounded-xl p-8 text-[#FAF6EE] text-center">
        <h2 className="text-xl font-bold mb-4">{data.title}</h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={data.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#B5453B] text-[#FAF6EE] px-6 py-3 rounded-lg font-medium hover:bg-[#9E3B32] transition-colors flex items-center justify-center gap-2"
          >
            {data.ctaLabel}
            <ArrowRight size={16} />
          </a>
          <a
            href={BOKA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[#FAF6EE]/30 text-[#FAF6EE] px-6 py-3 rounded-lg font-medium hover:bg-[#FAF6EE]/10 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar size={15} />
            Boka ett samtal
          </a>
        </div>
        <p className="text-xs text-[#FAF6EE]/50 mt-4 flex items-center justify-center gap-1">
          Betalning sker säkert via Kajabi <ExternalLink size={11} />
        </p>
      </div>
    </div>
  )
}

export function PlatformPage() {
  return (
    <MembershipLanding
      data={{
        eyebrow: 'Medlemskap',
        title: 'Entreprenörens Plattform',
        lead: 'Kunskapsbibliotek, kommenterade mallar, månatliga live-sessioner och community. 499 kr/mån.',
        includes: [
          'Kunskapsbibliotek — artiklar, guider och videoinnehåll som växer med ditt företag',
          'Mallbibliotek — kommenterade mallar med Johns perspektiv inbyggt',
          'Månatliga live-sessioner — Q&A och fördjupning i aktuella ämnen',
          'AI-verktyg — Business Readiness Check och framtida analysverktyg',
          'Community — nätverk med andra entreprenörer i liknande fas',
        ],
        prices: [
          { amount: '499 kr', period: '/mån', note: 'Månadsvis, ingen bindningstid.' },
          { amount: '3 990 kr', period: '/år', note: 'Spara två månader med årsbetalning.' },
        ],
        perk: 'Köpt Startup Kit? Du får 30 dagars fri tillgång till Plattformen.',
        ctaLabel: 'Bli medlem — 499 kr/mån',
        checkoutUrl: CHECKOUT.plattformen,
      }}
    />
  )
}

export function InnerCirclePage() {
  return (
    <MembershipLanding
      data={{
        eyebrow: 'Medlemskap',
        title: 'Entreprenörens Inre Krets',
        lead: 'Peer group med 6–8 entreprenörer. Personligt 1:1 med John. Från 2 990 kr/mån.',
        includes: [
          'Peer group med 6–8 entreprenörer — varannan vecka, 90 minuter',
          'Personligt 1:1 med John — 30 minuter varje månad',
          'Asynkron frågekanal — ställ frågor mellan sessionerna',
          'Hela Entreprenörens Plattform ingår — kunskapsbibliotek, mallar, live-sessioner och community',
        ],
        forWho: {
          title: 'För vem?',
          body: 'Entreprenörer som vill ha både affärsstöd och personligt bollplank. Du driver redan ett bolag och vill utvecklas tillsammans med andra i liknande fas — med Johns erfarenhet som gemensam nämnare. Varje grupp består av 6–8 entreprenörer för att säkerställa kvalitet och engagemang.',
        },
        prices: [{ amount: '2 990 kr', period: '/mån', note: 'Begränsat antal platser — max 8 per grupp, manuellt godkännande.' }],
        ctaLabel: 'Skicka ansökan',
        checkoutUrl: CHECKOUT.inreKrets,
      }}
    />
  )
}
