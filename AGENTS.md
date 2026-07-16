# AGENTS.md — Grundat (project entrypoint)

> **Tunn pekfil.** Detta är en project entrypoint som kopplar repositoryt till portfölj- och
> governance-SOT i `skipper_os`. Den **duplicerar inte** portföljstyrningen och skapar **ingen**
> alternativ source of truth. Vid konflikt gäller `skipper_os`-governance.

## A. Repository identity
```yaml
project_id: grundat
canonical_name: Grundat
repository: tengstromjohn-create/entreprenorensdashboard
portfolio_object_type: product
```

## B. Source of truth
- **Detta repository = implementation-SOT** för Grundats kod, tekniska konfiguration och
  repository-specifika backlog.
- **`skipper_os` = governance-SOT** för portfolio governance, Project Contract, canonical identity,
  policy, authority och cross-project coordination.
- **Runtime-SOT** = runtime-/deploymentmetadata där sådana system finns (t.ex. Vercel, Supabase).
- **Chattsessioner är inte SOT.**
- **Lokala Dropbox-kopior är arbetsytor/mirror, inte självständig SOT.** GitHub är normativ yta.

## C. Normativ läsordning
1. Denna fil (`AGENTS.md`).
2. Repository-specifika säkerhets-/utvecklingsinstruktioner (om/när de finns).
3. `skipper_os/AGENTS.md` — https://github.com/tengstromjohn-create/skipper_os/blob/main/AGENTS.md
4. Project Contract för `grundat` — https://github.com/tengstromjohn-create/skipper_os/blob/main/35_portfolio/projects/grundat.md
5. Aktuellt work item (t.ex. WI-004) — https://github.com/tengstromjohn-create/skipper_os/blob/main/60_operations/work-items/WI-004-project-entrypoint-rollout.md
6. Repositoryts tekniska dokumentation (`README.md` m.fl.).
7. Senaste relevanta handover (i `skipper_os/70_handoffs/`).

> **Högre governance i `skipper_os` har företräde vid konflikt.**

## D. Modellneutralitet
Denna fil gäller **oberoende av modell/verktyg** — Claude Code, Codex, ChatGPT med GitHub-åtkomst
och andra framtida modeller. Eventuella modellunika filer (`CLAUDE.md`, `CODEX.md`, `.cursorrules`)
får endast vara **tunna adaptrar som pekar hit** och får inte innehålla konkurrerande governance.

## E. Scope och authority
Modeller **får**:
- läsa repositoryt; analysera kod och dokumentation; föreslå ändringar;
- göra ändringar **på uttryckligt godkänd branch och inom ett aktivt work item**;
- köra relevanta lokala tester/valideringar (t.ex. `npm run lint`, `npm run build`);
- skapa commits och **draft-PR** när work item tillåter det.

Modeller **får inte**:
- deploya utan uttryckligt godkännande;
- ändra secrets eller produktionsdata;
- ändra portfolio taxonomy eller Project Contract **lokalt** (det görs i `skipper_os`);
- ändra andra repositoryn inom detta uppdrag;
- radera eller skriva över okänt WIP;
- fatta produkt-, affärs- eller governancebeslut åt John;
- behandla gissningar som verifierad status.

## F. Project Contract
Grundats Project Contract i `skipper_os` styr **scope, mål, AUTO/ASK/DENY och begränsningar**:
https://github.com/tengstromjohn-create/skipper_os/blob/main/35_portfolio/projects/grundat.md
- Lokala dokument får **komplettera** implementationen men **inte motsäga** contractet.
- **Ändring av contractet görs i `skipper_os`, inte här.**

## G. Work-item gate
Allt större arbete ska vara kopplat till ett work item. Kräv minst:
```yaml
work_item_id:
objective:
allowed_repositories:
allowed_paths:
data_classification:
auto_ask_deny:
definition_of_done:
```
Saknas detta: stanna vid **read-only-analys** eller be om tydligare instruktion.

## H. Grundat-specifika principer
- **Grundat** är ett **produktobjekt**, inte namnet på repositoryt.
- Repositorynamnet **`entreprenorensdashboard`** behålls som **tekniskt namn** (canonical name = `Grundat`).
- Namnsprawl hanteras med **aliases och metadata** i registret — inte genom oplanerade repo-/kodbyten.
- **Produktstatus får inte antas** utifrån mockar, demo-data eller gamla dokument.
- Skilj alltid mellan **aktiv, fungerande, mockad, experimentell och planerad** funktionalitet.
- **Nya produktbeslut kräver Johns godkännande.**
- Skilj **kundvärde/outcome** från **teknisk aktivitet**.

## I. Handover
Varje större arbetsinsats avslutas med en handover som anger: branch; HEAD; PR; ändrade filer;
tester; kvarvarande blockers; okänt/orört WIP; nästa rekommenderade steg.

---
*Governance-SOT: [skipper_os](https://github.com/tengstromjohn-create/skipper_os/blob/main/AGENTS.md) · Entrypoint-plan: [PROJECT_ENTRYPOINT_PLAN.md](https://github.com/tengstromjohn-create/skipper_os/blob/main/35_portfolio/PROJECT_ENTRYPOINT_PLAN.md) · Registry: [PROJECT_REGISTRY.yaml](https://github.com/tengstromjohn-create/skipper_os/blob/main/35_portfolio/PROJECT_REGISTRY.yaml). Detta är WI-004A. PR ska inte mergas utan Johns godkännande.*
