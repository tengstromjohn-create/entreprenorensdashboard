/**
 * Health Check — frågemodell (reviderad 2026-06-08).
 *
 * En enda källa för wizardens steg, frågor och autohämtade datapunkter.
 * Designprinciper:
 *  - Data som finns hos Bolagsverket FRÅGAS INTE — visas som autohämtad (auto-fält).
 *  - Frågor är radioknappar där det går (lägre tröskel, jämförbara svar).
 *  - Fritext bara där nyansen behövs (verksamhetsbeskrivning).
 *  - Blandar juridiska frågor med affärsfrågor som PÅVERKAR den juridiska riskbilden
 *    (personuppgifter, IP-ägande, nyckelpersonsberoende, tillståndsplikt, internationell handel).
 *  - Varje fråga är taggad med `area` (matchar bedömningsmallens 5 områden) + `weight`
 *    (hur tungt svaret väger i riskbilden) så Legal Source Genie och scoringen kan
 *    resonera strukturerat.
 */

export type QuestionType = 'radio' | 'textarea'

export interface HealthCheckOption {
  value: string
  label: string
  /** risk-signal: 0 = bra, 1 = mindre brist, 2 = väsentlig brist, 3 = kritiskt. null = neutral/kontext */
  risk?: 0 | 1 | 2 | 3 | null
}

export interface HealthCheckQuestion {
  id: string
  label: string
  help?: string
  type: QuestionType
  area: HealthCheckAreaKey
  options?: HealthCheckOption[]
  placeholder?: string
  optional?: boolean
}

export interface HealthCheckStep {
  key: string
  label: string
  icon: 'Building2' | 'Scale' | 'FileSignature' | 'Users' | 'Coins'
  intro?: string
  questions: HealthCheckQuestion[]
}

export type HealthCheckAreaKey =
  | 'struktur'
  | 'agande_styrning'
  | 'avtal_ip'
  | 'personal'
  | 'ekonomi_compliance'

export const HEALTH_CHECK_AREAS: { key: HealthCheckAreaKey; name: string; weight: number }[] = [
  { key: 'struktur', name: 'Bolagsstruktur', weight: 0.2 },
  { key: 'agande_styrning', name: 'Ägande & styrning', weight: 0.25 },
  { key: 'avtal_ip', name: 'Avtal & immateriella tillgångar', weight: 0.2 },
  { key: 'personal', name: 'Personal & arbetsrätt', weight: 0.15 },
  { key: 'ekonomi_compliance', name: 'Ekonomi & regelefterlevnad', weight: 0.2 },
]

const YES_NO_UNSURE: HealthCheckOption[] = [
  { value: 'yes', label: 'Ja', risk: 0 },
  { value: 'no', label: 'Nej', risk: 2 },
  { value: 'unsure', label: 'Vet ej', risk: 1 },
]

export const HEALTH_CHECK_STEPS: HealthCheckStep[] = [
  {
    key: 'verksamhet',
    label: 'Verksamheten',
    icon: 'Building2',
    intro: 'Kort om vad bolaget gör — ger kontext till riskanalysen. Bolagsdata hämtas automatiskt från Bolagsverket.',
    questions: [
      {
        id: 'businessDescription',
        label: 'Beskriv kort vad bolaget gör',
        help: 'Bransch, produkt/tjänst och hur länge ni varit verksamma.',
        type: 'textarea',
        area: 'struktur',
        placeholder: 'T.ex. SaaS för restaurangbokningar, B2B, verksamma sedan 2022.',
      },
      {
        id: 'customerType',
        label: 'Vilka är era kunder?',
        type: 'radio',
        area: 'avtal_ip',
        options: [
          { value: 'b2b', label: 'Företag (B2B)', risk: 0 },
          { value: 'b2c', label: 'Konsumenter (B2C)', risk: 1 },
          { value: 'both', label: 'Både och', risk: 1 },
          { value: 'public', label: 'Offentlig sektor', risk: 1 },
        ],
        help: 'Påverkar konsumenträtt, LOU och avtalsvillkor.',
      },
      {
        id: 'personalData',
        label: 'Hur mycket personuppgifter behandlar ni?',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'none', label: 'Inga / minimalt', risk: 0 },
          { value: 'limited', label: 'Begränsat (kunduppgifter)', risk: 1 },
          { value: 'extensive', label: 'Omfattande', risk: 2 },
          { value: 'sensitive', label: 'Känsliga uppgifter (hälsa, m.m.)', risk: 3 },
        ],
        help: 'Styr GDPR-kraven.',
      },
      {
        id: 'international',
        label: 'Säljer ni utanför Sverige?',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'no', label: 'Nej, bara Sverige', risk: 0 },
          { value: 'eu', label: 'Ja, inom EU', risk: 1 },
          { value: 'global', label: 'Ja, även utanför EU', risk: 2 },
        ],
        help: 'Påverkar moms, dataöverföring och internationell avtalsrätt.',
      },
    ],
  },
  {
    key: 'agande',
    label: 'Ägande & styrning',
    icon: 'Scale',
    questions: [
      {
        id: 'numberOfOwners',
        label: 'Hur många ägare har bolaget?',
        type: 'radio',
        area: 'agande_styrning',
        options: [
          { value: 'one', label: 'En ägare', risk: 0 },
          { value: 'few', label: '2–3 ägare', risk: null },
          { value: 'many', label: '4 eller fler', risk: null },
        ],
      },
      {
        id: 'hasShareholderAgreement',
        label: 'Finns ett aktieägaravtal?',
        help: 'Kritiskt vid fler än en ägare — reglerar exit, värdering och konflikter.',
        type: 'radio',
        area: 'agande_styrning',
        options: YES_NO_UNSURE,
      },
      {
        id: 'hasBoardRules',
        label: 'Finns en styrelsearbetsordning?',
        type: 'radio',
        area: 'agande_styrning',
        options: YES_NO_UNSURE,
      },
      {
        id: 'articlesUpdated',
        label: 'Är bolagsordningen anpassad efter verksamheten?',
        help: 'T.ex. verksamhetsföremål, aktieslag, hembud.',
        type: 'radio',
        area: 'agande_styrning',
        options: YES_NO_UNSURE,
      },
      {
        id: 'keyPersonDependency',
        label: 'Är bolaget beroende av en eller få nyckelpersoner?',
        help: 'Påverkar behovet av vesting, successionsavtal och nyckelpersonsförsäkring.',
        type: 'radio',
        area: 'agande_styrning',
        options: [
          { value: 'no', label: 'Nej, robust', risk: 0 },
          { value: 'somewhat', label: 'Delvis', risk: 1 },
          { value: 'yes', label: 'Ja, starkt beroende', risk: 2 },
        ],
      },
    ],
  },
  {
    key: 'avtal',
    label: 'Avtal & IP',
    icon: 'FileSignature',
    questions: [
      {
        id: 'customerContracts',
        label: 'Hur ser era kundavtal ut?',
        type: 'radio',
        area: 'avtal_ip',
        options: [
          { value: 'standard', label: 'Skriftliga standardavtal', risk: 0 },
          { value: 'mixed', label: 'Blandat skriftligt/muntligt', risk: 1 },
          { value: 'verbal', label: 'Mest muntligt eller ad hoc', risk: 3 },
          { value: 'none', label: 'Inga formella avtal', risk: 3 },
        ],
      },
      {
        id: 'ipOwnership',
        label: 'Äger bolaget sina immateriella rättigheter?',
        help: 'Kod, varumärke, design — och har medarbetare/konsulter överlåtit rättigheterna?',
        type: 'radio',
        area: 'avtal_ip',
        options: [
          { value: 'documented', label: 'Ja, dokumenterat', risk: 0 },
          { value: 'partial', label: 'Delvis', risk: 2 },
          { value: 'no', label: 'Nej', risk: 3 },
          { value: 'unsure', label: 'Vet ej', risk: 2 },
        ],
      },
      {
        id: 'supplierDependency',
        label: 'Finns ett kritiskt beroende av enskild leverantör/plattform?',
        help: 'T.ex. en molnleverantör eller underleverantör som är svår att byta.',
        type: 'radio',
        area: 'avtal_ip',
        options: [
          { value: 'no', label: 'Nej', risk: 0 },
          { value: 'yes_contract', label: 'Ja, men reglerat i avtal', risk: 1 },
          { value: 'yes_nocontract', label: 'Ja, utan tydligt avtal', risk: 3 },
        ],
      },
      {
        id: 'usesNda',
        label: 'Använder ni sekretessavtal när ni delar känslig information?',
        type: 'radio',
        area: 'avtal_ip',
        options: YES_NO_UNSURE,
      },
    ],
  },
  {
    key: 'personal',
    label: 'Personal',
    icon: 'Users',
    intro: 'Antal anställda hämtas från Bolagsverket där det finns — bekräfta och komplettera.',
    questions: [
      {
        id: 'hasEmployees',
        label: 'Har bolaget anställda?',
        type: 'radio',
        area: 'personal',
        options: [
          { value: 'no', label: 'Nej, bara ägare/styrelse', risk: 0 },
          { value: 'yes', label: 'Ja', risk: null },
        ],
      },
      {
        id: 'hasEmploymentContracts',
        label: 'Har alla anställda skriftliga anställningsavtal?',
        help: 'Skriftlig information om anställningsvillkor är ett lagkrav (6 c § LAS).',
        type: 'radio',
        area: 'personal',
        options: [
          { value: 'yes', label: 'Ja, alla', risk: 0 },
          { value: 'some', label: 'Vissa', risk: 2 },
          { value: 'no', label: 'Nej', risk: 3 },
          { value: 'na', label: 'Ej aktuellt (inga anställda)', risk: null },
        ],
      },
      {
        id: 'usesConsultants',
        label: 'Anlitar ni konsulter eller frilansare löpande?',
        help: 'Felklassificering (konsult som egentligen är anställd) och IP-överlåtelse är vanliga risker.',
        type: 'radio',
        area: 'personal',
        options: [
          { value: 'no', label: 'Nej', risk: 0 },
          { value: 'yes_contract', label: 'Ja, med skriftliga avtal', risk: 1 },
          { value: 'yes_nocontract', label: 'Ja, utan tydliga avtal', risk: 3 },
        ],
      },
      {
        id: 'collectiveAgreement',
        label: 'Omfattas bolaget av kollektivavtal?',
        type: 'radio',
        area: 'personal',
        options: [
          { value: 'yes', label: 'Ja', risk: null },
          { value: 'no', label: 'Nej', risk: null },
          { value: 'unsure', label: 'Vet ej', risk: 1 },
        ],
      },
    ],
  },
  {
    key: 'ekonomi',
    label: 'Ekonomi & efterlevnad',
    icon: 'Coins',
    questions: [
      {
        id: 'financingType',
        label: 'Hur finansieras bolaget huvudsakligen?',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'bootstrap', label: 'Egna medel / löpande intäkter', risk: 0 },
          { value: 'loan', label: 'Lån', risk: 1 },
          { value: 'external', label: 'Externt riskkapital', risk: 1 },
          { value: 'grant', label: 'Bidrag/stöd', risk: 1 },
        ],
        help: 'Externt kapital ställer krav på aktieägaravtal och rapportering.',
      },
      {
        id: 'controlBalanceRisk',
        label: 'Har det egna kapitalet riskerat understiga halva aktiekapitalet?',
        help: 'Utlöser skyldighet att upprätta kontrollbalansräkning (25 kap. ABL).',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'no', label: 'Nej', risk: 0 },
          { value: 'yes', label: 'Ja', risk: 3 },
          { value: 'unsure', label: 'Vet ej', risk: 2 },
        ],
      },
      {
        id: 'insurance',
        label: 'Har bolaget ansvars- och styrelseansvarsförsäkring?',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'both', label: 'Ja, båda', risk: 0 },
          { value: 'one', label: 'Bara en av dem', risk: 1 },
          { value: 'no', label: 'Nej', risk: 2 },
          { value: 'unsure', label: 'Vet ej', risk: 1 },
        ],
      },
      {
        id: 'gdprCompliance',
        label: 'Hur långt har ni kommit med GDPR?',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'complete', label: 'Policy + personuppgiftsbiträdesavtal på plats', risk: 0 },
          { value: 'started', label: 'Påbörjat', risk: 1 },
          { value: 'no', label: 'Inte börjat', risk: 2 },
          { value: 'unsure', label: 'Vet ej', risk: 2 },
        ],
      },
      {
        id: 'permitsRequired',
        label: 'Kräver verksamheten särskilda tillstånd eller registreringar?',
        help: 'T.ex. Finansinspektionen, IVO, Spelinspektionen, alkoholtillstånd. (Legal Source Genie kommer kartlägga detta automatiskt.)',
        type: 'radio',
        area: 'ekonomi_compliance',
        options: [
          { value: 'have', label: 'Ja, och vi har dem', risk: 0 },
          { value: 'missing', label: 'Ja, men vi saknar dem', risk: 3 },
          { value: 'no', label: 'Nej', risk: 0 },
          { value: 'unsure', label: 'Vet ej', risk: 2 },
        ],
      },
    ],
  },
]

/** Frågor som är obligatoriska för att gå vidare (övriga får lämnas tomma → "ej besvarad"). */
export const REQUIRED_QUESTION_IDS = new Set<string>([
  'businessDescription',
  'numberOfOwners',
  'customerContracts',
  'hasEmployees',
  'financingType',
])

/** Hjälp för att rendera svarens etikett i admin/PDF. */
export function labelForAnswer(questionId: string, value: string): string {
  for (const step of HEALTH_CHECK_STEPS) {
    const q = step.questions.find((x) => x.id === questionId)
    if (q?.options) return q.options.find((o) => o.value === value)?.label ?? value
  }
  return value
}
