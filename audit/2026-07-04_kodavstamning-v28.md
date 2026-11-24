# Kodavstämning v.28 — spurt A–D-utfall, säkerhet, modellinventering

**Datum:** 2026-07-04
**Typ:** Ren audit — inga kodändringar, inga commits, ingen deploy.
**Underlag:** Kodbasen i `entreprenorens-dashboard` (senaste commit `120004b`), live-läsning av Supabase-projektet `rwpmtithujtlojoizljb` (tabeller, RLS, buckets, migrationshistorik), `npm audit` samt fullständigt bygge (`tsc -b && vite build`) i ren Linux-miljö.
**Arbetsträdet var rent** vid granskningen (`git status` tomt) och lämnades orört.

---

## Sammanfattning

Spurt A är **klar** och kör riktiga Roaring-anrop. Spurt B–C är **halvklar**: avtalsmotorn finns med NDA + anställningsavtal, wizard, Claude-QA och PDF-export — men styrelsearbetsordning och GDPR-handling saknas helt. Spurt D är **inte påbörjad**: inget dokumentarkiv med uppladdning, inga tabeller `company_documents`/`startup_workflows`, ingen starta-bolag-wizard. I stället har Startup Kit fått ett annat (enklare) startflöde än det planerade.

Säkerhetsläget är gott: PKCE utan secret bekräftat, `.env` ej committad, bygget rent. Två dokumentationsavvikelser är viktiga: **OIDC-scopet är inte längre enbart `openid`** och **QA-modellen är `claude-sonnet-4-20250514`**, inte den i CLAUDE.md angivna. D1-ingreppet (modellabstraktionslager) är litet — 5 filer berörs.

---

## DEL 1 — Spurt A–D-avstämning

### Spurt A — Roaring-integration: ✅ Klar

| Punkt | Status | Bevis |
|---|---|---|
| Riktiga Roaring-API-anrop i `lookup-company` | ✅ Finns | `supabase/functions/lookup-company/index.ts` (292 rader). OAuth client_credentials mot `api.roaring.io/token` (rad 20–46), fyra parallella anrop: overview, board-members, signatory, signing-combinations — alla v2.0 (rad 156–161). Mock används **endast som fallback** när credentials saknas (rad 114–146, markerad `source: 'mock'`). |
| Roaring-nyckel som Supabase secret | ✅ Finns | `ROARING_CLIENT_ID`/`ROARING_CLIENT_SECRET` läses via `Deno.env.get` i `lookup-company/index.ts:110–111` och `_shared/roaring.ts:14–15`. Aldrig i frontend/VITE-vars. |
| Firmateckning, styrelse, bolagsstatus från riktig data i UI | ✅ Finns | `src/components/dashboard/CompanyZone.tsx`: firmateckningsregel + klausul + behöriga firmatecknare (rad 208–232), styrelse (rad 247–255), status via `useCompanyData.ts:51` → `lookup-company`. Firmateckningsklausulen klassificeras strukturerat (`classifySignatory`, rad 69–77) för avtalsmotorn. |
| Utöver spec | ✅ | `_shared/roaring.ts` (159 rader): delad klient + `fetchEngagements` (Company Engagements 3.0) för "Dina bolag". Nya edge functions `get-my-companies` (82 rader) och `get-company-overview` (72 rader). |

**Restpunkter Spurt A:**
1. `lookup-company` har en egen äldre kopia av token-logiken; den delade i `_shared/roaring.ts` används inte där ännu (noterat som TODO i `roaring.ts:7–8`).
2. Sandbox-overriden `TEST_ENGAGEMENT_PNR` (`_shared/roaring.ts:108`) **måste avregistreras före produktion** — koden säger det själv (`supabase secrets unset TEST_ENGAGEMENT_PNR`).

### Spurt B–C — Avtalsmotorn: 🟡 Delvis (2 av 4 avtalstyper)

| Punkt | Status | Bevis |
|---|---|---|
| Edge function `generate-contract` | ✅ Finns | `supabase/functions/generate-contract/index.ts` (211 rader). Gemini → Claude-QA (`runQAPipeline`) → flaggat levereras ALDRIG (rad 181–191). BankID-krav upprätthålls server-side (rad 57–62). |
| Gemini-prompter NDA + Anställningsavtal | ✅ Finns | `generate-contract/prompts.ts` (101 rader): `NDA_PROMPT` (rad 33) + `EMPLOYMENT_PROMPT` (rad 63), med Johns röst och svenska redigeringsregler. |
| Gemini-prompter Styrelsearbetsordning + GDPR-handling | 🔴 Saknas | 0 träffar i hela repot. `contractType` valideras hårt till `'nda' \| 'employment'` (`index.ts:44`). |
| Wizard-frontend | ✅ Finns (annan route) | `src/pages/ContractEngine.tsx` (755 rader): flerstegs-wizard med `ProgressBar`, `NDA_STEPS`/`EMP_STEPS` (rad 279), stegvy från rad 589. Route är **`/dashboard/verktyg/avtal`** (`App.tsx:59`) — inte `/dashboard/avtal/` som i spurtplanen. |
| pdf-lib med UTKAST-watermark + signaturrad + ASTRA-header | ✅ Finns (medveten designavvikelse) | `export-contract-pdf/index.ts` (438 rader), `pdf-lib@1.17.1` (rad 2). UTKAST-vattenstämpel på varje sida av avtalet (rad 160–167). **ASTRA-headern ligger avsiktligt på instruktionsdokumentet, inte på avtalet** — avtalet är neutralt, "parternas dokument, inte byråns" (rad 11–17, header rad 174–191). Signaturblock genereras i avtalstexten via prompten ("Avsluta med signaturblock… anpassat för digital signering", `prompts.ts:56, 89`) och renderas i PDF:en — ingen separat PDF-layoutkomponent för signaturrad. |
| Tabellmigration `contracts` | 🟡 Finns live, saknas i repot | Tabellen finns i Supabase med RLS aktiverad (4 rader). Migrationshistoriken innehåller `20260607183533_create_contracts_table` + `20260607190426_contracts_summary_and_export_bucket`. **Men `supabase/migrations/` finns inte i repot** — ingen migration är versionerad i git. |
| Storage bucket `contracts` | 🟡 Annan bucket | Bucketen heter **`contract-exports`** (privat, verifierad live — den enda bucketen i projektet). Signerade URL:er 1 h (`index.ts:402–417`). Funktionellt ekvivalent med spec:ens `contracts`. |

### Spurt D — Dokument + workflow: 🔴 Saknas

| Punkt | Status | Bevis |
|---|---|---|
| `/dashboard/dokument` med upload/list/download mot `company-files` | 🔴 Saknas | Ingen sådan route i `App.tsx` (rad 43–76). Ingen uppladdningskod i `src/`. Bucketen `company-files` finns inte (live-bucketlistan = endast `contract-exports`). Det som finns är "Dokumentarkiv (slim)" i `Styrhytten.tsx:162–168` — en **läsvy som bara listar rader ur `contracts`**, ingen filhantering. |
| Migrationer `company_documents` + `startup_workflows` med RLS | 🔴 Saknas | Finns varken i migrationshistoriken (4 poster, se ovan) eller som live-tabeller. Live-schemat `public` innehåller exakt 8 tabeller: de 7 dokumenterade + `contracts`. |
| `/dashboard/verktyg/starta-bolag` som 5-stegs wizard | 🔴 Saknas (ersatt av annat) | Routen finns inte. I stället byggdes `StartupKit.tsx` om 2026-06-08 (244 rader, route `/dashboard/verktyg/startup-kit`) till ett **startflöde med två vägar**: "Starta från grunden" (grundhandlingar + verksamt.se-guide) och "Köp lagerbolag" (bolagsratt.se + Johns hjälp). Vägledning i appen, faktisk registrering externt. Detta är inte 5-stegs-wizarden ur spurtplanen — och inte heller den "interaktiva beslutsplattformen" ur produkttrappan. |

---

## DEL 2 — Säkerhets- och konfigverifiering

**`client_secret` / `VITE_SCRIVE` i `src/`:** ✅ Bekräftat 0 funktionella träffar. `VITE_SCRIVE`: 0 träffar totalt. `client_secret`: 3 träffar, samtliga dokumentation — kommentarer i `src/lib/auth.ts:7, 24` och loggtexten `'[Auth Init] Mode: PKCE Public Client (inget client_secret i frontend)'` i `src/main.tsx:13`. Ingen secret-variabel läses eller skickas.

**Alla `VITE_*`-variabler som läses i koden:**

| Variabel | Läses i |
|---|---|
| `VITE_OIDC_AUTHORITY` | `src/lib/auth.ts:17`, `src/main.tsx:11` (logg) |
| `VITE_SIGNICAT_CLIENT_ID` | `src/lib/auth.ts:18`, `src/main.tsx:12, 16` (logg + guard med felvy) |
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts:3`, `src/lib/edge-functions.ts:46` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts:4`, `src/lib/edge-functions.ts:47` |
| `VITE_SITE_PASSWORD` | `src/components/SiteGate.tsx:17` |

`VITE_DEV_BYPASS_AUTH` **finns inte längre i koden** — CLAUDE.md:s uppgift om dev-bypass är inaktuell. 8-sekunders timeout-fallbacken finns kvar (`AuthContext.tsx:103–110`).

**PKCE i `src/lib/auth.ts`:** ✅ Bekräftat Public Client: `response_type: 'code'`, ingen `client_secret`, PKCE S256 automatiskt via oidc-client-ts v3, userStore i `sessionStorage`.

⚠️ **Scope-avvikelse:** scope är **`'openid profile nin'`** med `loadUserInfo: true` (`auth.ts:22, 28`) — inte "enbart openid" som CLAUDE.md föreskriver (inkl. förbudet mot `profile`-scope). Ändringen är medveten (commits `6c3654f`, `8d42713`: Signicat levererar nin/namn via UserInfo-endpointen) och fungerar uppenbarligen mot sandboxen. **CLAUDE.md måste uppdateras**, och Signicat-tenantens tillåtna scopes bör bekräftas i samband med restpunkten S1.4 (Public Client-konfig i portalen — kan inte verifieras från koden).

**Övrigt noterat:**
- `.env` är **inte** git-trackad (endast `.env.example`) — bra.
- `app.johntengstrom.se` förekommer fortfarande på två ställen, mot CLAUDE.md-regeln: `_shared/qa-pipeline.ts:6` (QA-systemprompten presenterar plattformen med gamla domänen) och `verify-client/index.ts:41` (fallback-redirect när `SITE_URL` saknas).
- `admin-api/index.ts` refererar tabellerna `profiles` (rad 17) och `activity_log` (rad 57) — **ingen av dem existerar i databasen**. Funktionen anropas inte från frontend; trolig legacy. Bör städas eller tas bort.

---

## DEL 3 — Modellinventering (underlag för D1)

### Samtliga hårdkodade modell-ID:n

| Modell-ID | Fil | Rad | Kontext |
|---|---|---|---|
| `gemini-2.5-flash` | `supabase/functions/generate-health-check/index.ts` | 165 | API-URL |
| `gemini-2.5-flash` | `supabase/functions/generate-startup-docs/index.ts` | 185 | API-URL |
| `gemini-2.5-flash` | `supabase/functions/generate-contract/index.ts` | 78 | API-URL |
| `gemini-2.5-flash` | `supabase/functions/generate-contract/index.ts` | 141 | `geminiMeta.model` till QA-pipelinen |
| `gemini-2.5-flash` | `supabase/functions/generate-contract/index.ts` | 171 | kolumnvärde `contracts.gemini_model` |
| `claude-sonnet-4-20250514` | `supabase/functions/_shared/qa-pipeline.ts` | 151 | `model` i Anthropic-anropet |
| `claude-sonnet-4-20250514` | `supabase/functions/_shared/qa-pipeline.ts` | 208 | kolumnvärde `ai_qa_reviews.qa_model` |

Embeddings-modeller: **inga förekomster.** `knowledge_chunks`/pgvector finns varken i kod eller live-databas — KB/RAG-spåret är odokumenterat papper, inte kod.

⚠️ QA-modellen är alltså **`claude-sonnet-4-20250514`** — inte `claude-sonnet-4-6` som CLAUDE.md anger. Modellvalet bör ses över i samma veva som D1 (nyare Sonnet för QA), men det är ett separat beslut från abstraktionslagret.

### Hur `_shared/qa-pipeline.ts` anropar Anthropic

Rå `fetch` mot `https://api.anthropic.com/v1/messages` — **ingen SDK** (rad 143–159). Headers: `x-api-key` från `ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`. Modell-ID:t sätts inline i request-bodyn (rad 151), `max_tokens: 4096`, systemprompt + ett user-meddelande med Gemini-outputen som JSON. Graceful degradation finns redan: saknad nyckel → auto-approve dev-läge (rad 121–139); Claude-fel → Gemini-output godkänns med notering (rad 225–250).

### Minsta ingrepp för `_shared/llm.ts` (förslag — EJ implementerat)

Beteendet bevaras exakt genom att env-defaults sätts till dagens ID:n:

```ts
// supabase/functions/_shared/llm.ts
export const GENERATION_MODEL =
  Deno.env.get('GENERATION_MODEL') ?? 'gemini-2.5-flash'
export const QA_MODEL =
  Deno.env.get('QA_MODEL') ?? 'claude-sonnet-4-20250514'

export interface LlmResult {
  text: string | undefined
  tokensIn?: number
  tokensOut?: number
}

/** Gemini generateContent — ersätter de tre inline-fetcharna. */
export async function generateWithGemini(
  prompt: string,
  config?: {
    temperature?: number
    maxOutputTokens?: number
    thinkingBudget?: number
    responseMimeType?: string
  }
): Promise<LlmResult>

/** Anthropic Messages — ersätter fetchen i qa-pipeline. */
export async function qaWithClaude(
  system: string,
  userContent: string,
  maxTokens?: number
): Promise<LlmResult & { raw: unknown }>
```

Berörda filer (5 st):

1. `_shared/llm.ts` — ny.
2. `_shared/qa-pipeline.ts` — rad 143–159 ersätts med `qaWithClaude`; rad 151 och 208 läser `QA_MODEL`.
3. `generate-health-check/index.ts` — rad ~160–180 ersätts med `generateWithGemini`; `geminiMeta.model` läser `GENERATION_MODEL`.
4. `generate-startup-docs/index.ts` — motsvarande.
5. `generate-contract/index.ts` — rad 76–104 ersätts; rad 141 och 171 läser `GENERATION_MODEL`.

Loggningen är redan förberedd: `gemini_model`/`qa_model` skrivs till `ai_qa_reviews` och `contracts` — de börjar automatiskt spegla env-värdena när konstanterna används. Uppskattad insats: under en halv dag inkl. regressionstest av en health check + ett NDA. Modellväxlingen i sig (D1) blir därefter ren konfiguration.

---

## DEL 4 — Övrig lägesbild

### npm audit

**9 sårbarheter: 2 low, 2 moderate, 5 high — samtliga med fix via `npm audit fix`.** Berörda paket: `hono` (high, flera advisories — path traversal m.m.), `ws` (high, DoS), `vite` (`server.fs.deny`-bypass på Windows), `launch-editor` (NTLMv2-läcka på Windows), `esbuild` (low), `@babel/core` (low). Inget av dem är en direkt runtime-dependency i produktionsbundlen — det rör byggverktyg och transitiva beroenden (bl.a. via supabase-js-kedjan); flera advisories är dessutom Windows-specifika. Rekommendation: kör `npm audit fix` vid nästa arbetspass, ingen akut åtgärd.

### Bygge

`tsc -b`: **0 fel.** `vite build` (7.3.3): **rent, inga varningar.** 1 932 moduler, output `dist/assets/index-*.js` 215,85 kB (66,44 kB gzip) + CSS 66,27 kB. Bygget kördes i ren Linux-miljö med färsk `npm ci` — repots incheckade `node_modules` är macOS-binärer och påverkar inte CI/Vercel.

### Avvikelser mot CLAUDE.md:s modulstatustabell

| Modul | CLAUDE.md säger | Verkligt läge 2026-07-04 |
|---|---|---|
| ED-1 (auth-spår) | ✅ Klar | ✅ Stämmer — men scope är `openid profile nin` + `loadUserInfo`, och dev-bypass-variabeln är borttagen. |
| ED-2 (backend) | ✅ 7 tabeller, 7 edge functions | Nu **8 tabeller** (+ `contracts`) och **13 edge functions** (+ `generate-contract`, `export-contract-pdf`, `get-my-companies`, `get-company-overview`, `admin-health-reviews`). `qa-pipeline.ts` är 279 rader. Vyn `ai_qa_dashboard` ej verifierad i denna audit. |
| ED-3 (dashboard) | ✅ Klar | ✅ — men omstrukturerad: "Styrhytten"-navet (`/dashboard/bolag`), tvåkolumnslayout, nya sidor `Membership`, `Welcome`, `DashboardHome`. |
| ED-4 Startup Kit | 🟡 Frontend = placeholder 78 rader | 🟡 **Ändrad karaktär:** `StartupKit.tsx` är nu 244 rader startflöde (två vägar, extern registrering). Det är varken placeholder eller den beslutade interaktiva beslutsplattformen. **`generate-startup-docs` (250 rader) anropas inte längre från någon frontend-vy** — backenden är föräldralös. |
| ED-5 Health Check | ✅ 911 rader | ✅ Klar men reviderad (commit `27c887e`): `HealthCheck.tsx` är nu 708 rader, ny frågemodell + juristgranskning (`review_status: 'lawyer_reviewed'`). |
| ED-6 Admin | 🟡 Placeholder 82 rader | 🟡 Delvis mer: `Admin.tsx` (86 rader) innehåller nu skarp `AdminHealthReviews`-komponent + edge function `admin-health-reviews` (103 rader) för rättning av AI-analyser. Resten är fortfarande placeholder-kort. |

**Övriga avvikelser mot CLAUDE.md:** QA-modell-ID (se Del 3) · `app.johntengstrom.se`-rester (se Del 2) · Avtalsmotorn (`ContractEngine`) saknas helt i CLAUDE.md:s modultabell trots att den är den största nya modulen · Inga migrationsfiler i repot trots 4 remote-migrationer · Frontend anropar edge functions via egen `callEdgeFunction`-wrapper (`edge-functions.ts`), inte `supabase.functions.invoke`.

---

## Rekommenderad justering av sprintplan v.29–v.30

Utfallet avviker från antagandet att spurt A–D är helt klara: **A är klar, B–C är halva, D är noll.** Planen bör justeras så här:

**1. Behåll (oförändrat från systemdesigndokumentet § 6):** D1-lagret `_shared/llm.ts` är ett halvdagsjobb enligt Del 3 — gör det först i v.28/29 så att modellmigreringen inför 16 okt blir ren konfiguration. Bolagsverket-providern (D2) i `lookup-company` och Kajabi-checkouten ligger fast.

**2. Ersätt "ED-4-frontend (wizard)" med ett produktbeslut:** Startup Kit-frontenden är inte längre en placeholder utan ett medvetet omgjort startflöde som skickar användaren till verksamt.se/bolagsratt.se — samtidigt som `generate-startup-docs`-backenden (inkl. QA-pipeline) står oanvänd. Innan någon bygger wizarden enligt HealthCheck-mönstret måste det avgöras: ska Startup Kit vara beslutsplattformen ur produkttrappan (då återkopplas backenden och wizarden byggs), eller är det nya guideflödet produkten för lanseringen (då bör `generate-startup-docs` avvecklas eller parkeras, och produkttrappans beskrivning uppdateras)? Detta påverkar direkt vad 1 490 kr-checkouten säljer.

**3. Omplanera spurt D explicit:** Dokumentarkiv med uppladdning och starta-bolag-workflow finns inte och hinns rimligen inte före den smala lanseringen 31 aug. Rekommendation: stryk dem ur lanseringsomfånget (Readiness Check + Startup Kit behöver dem inte), flytta till september-spåret, och uppdatera CLAUDE.md så att ingen planerar ovanpå moduler som inte existerar.

**4. Färdigställ avtalsmotorn medvetet:** styrelsearbetsordning + GDPR-handling är kvarvarande B–C-omfång (prompter + två poster i wizardens typval — mönstret är etablerat). Kan gå i v.29–30 om ED-4-beslutet frigör tid, annars efter lansering.

**5. Lägg in en städpunkt (liten men viktig före lansering):** avregistrera `TEST_ENGAGEMENT_PNR` · fixa `verify-client`-fallbacken och QA-promptens domän till `grundat.ai` · ta bort/åtgärda `admin-api` (döda tabellreferenser) · migrera `lookup-company` till delade `_shared/roaring.ts` · börja versionera migrationer i repot (`supabase db pull`) · uppdatera CLAUDE.md (scope, modell-ID, modultabell, edge function-lista).

**6. Oförändrat kritiskt:** AI Act art. 50-paketet (`AiDisclosure` + PDF-märkning + villkorstext) före 2 aug har inga nya hinder — `model_used`-loggningen som art. 50-metadatan behöver finns redan i `ai_qa_reviews` och `contracts`.
