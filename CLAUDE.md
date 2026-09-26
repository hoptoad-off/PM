# CLAUDE.md — PM Persistent Memory
> Source of truth for Claude when working inside the PM folder.
> This is the **project management** workspace — separate from Career-Vault.
> Career-Vault is Bekhruz's personal/strategic vault. PM is the team's shared workspace.
>
> **Rule of thumb for what belongs here:** If you would not send it to Alex or Timur,
> it does not belong in PM. No pricing tables, no brand voice rules, no personal preferences,
> no admissions strategy. Project facts, deadlines, technical constraints — yes.

---

## Who works in this folder

| Role | Person | What they do |
|---|---|---|
| **PM / Visionary** | Bekhruz | Writes specs, sets priorities, reviews PRs. Single source of truth for direction. |
| **Middle Developer** | Alex | Builds features. Reads specs, opens PRs, owns architecture decisions within the spec. |
| **Intern Developer** | Timur | Builds features under guidance. Same workflow as Alex (PR-per-task) — he's the more responsible of the two. |
| **Designer / Frontend** | Amir | Owns UI polish and visual consistency. Same workflow as Alex and Timur (PR-per-task). |

Bekhruz does not track Linear. Linear is the team's personal scratchpad if they want one.
**Truth lives in this folder.** Truth = the markdown files + the git history.

---

## The Funnel framing

"Funnel" in this folder means the **marketing funnel** — how a person becomes and stays a customer of Oxbridge International School. It is the umbrella that organizes everything we build:

| Stage | Folder | What it does | Stakeholder |
|---|---|---|---|
| **Top of funnel** | `Funnel/1-School-site/` | Awareness, SEO, lead capture, marketing site | Prospective parents |
| **Middle of funnel** | `Funnel/2-CRM/` | Lead capture and conversion — IP telephony (UCM6304), amoCRM, call routing, lead nurturing | Admissions team |
| **Bottom of funnel** | `Funnel/3-Parent-App/` | Value delivery to current customers — payments, attendance, meals, passes, etc. | Current parents (and eventually teachers, admins) |

Every product, decision, and ticket lives under one of these stages. If something doesn't fit, we have a scope problem and need to talk before building.

---

## Active products

### Funnel/3-Parent-App — HARD DEADLINE: 15 August 2026
The bottom-of-funnel product. A web/mobile app for current parents.

**Initial surfaces (Aug 15 deliverable):**
- Payments (balance, Click/PayMe, webhooks)
- Attendance visibility
- Meals schedule
- Passes (Hikvision integration — entry/exit, push notifications)
- Uniform orders (inventory, payment, pickup)
- Bus tracking (routes, boarding/dropoff, notifications)
- Messaging (parent ↔ school)

**Why these:** these are the early "quick wins" that prove value to parents and drive download/engagement. Without them, parents don't open the app, and the rest of the platform fails to land.

**Long-shadow vision (2027–28 academic year):**
The Parent App is the **seed of our SIS** (Student Information System). In academic year 2027–28 we plan to fully replace Toddle with our own system, layered on top of Google fundamentals. Architecture decisions made for the Aug 15 deliverable must not paint us into a corner — auth must accommodate teachers and admins, the data model must be extensible to grades/attendance/scheduling at the SIS level, APIs must be first-class so other surfaces can build on them.

**How to encode this in handoff docs:** the `_Hub.md` for Parent App carries the 2027–28 vision so context exists. Individual PRDs and Specs focus on the Aug 15 deliverable but flag SIS-impacting decisions explicitly in a `Future-state considerations` section.

### Funnel/2-CRM
Sales/CRM stack. UCM6304 IP telephony + amoCRM. Lead routing by campus (MU, YA), call recordings, early-stage qualification, pipeline. See `Funnel/2-CRM/_Hub.md`.

### Funnel/1-School-site
Marketing site. CWV/SEO work in progress. Existing project — most tickets carry over from Linear.

---

## Products/ — internal tools outside the funnel

Not everything we build serves the funnel. Internal operational tools — used by
staff, not by parents or leads — live under `Products/<product-name>/`, with the
same shape as a funnel stage: `_Hub.md`, `Specs/`, `Tasks/`, `Decisions/`.

Task IDs are shared with the rest of PM — `T-NNN` is unique across the whole
repo, not per folder.

| Product | Folder | What it is |
|---|---|---|
| **retro-villain** | `Products/retro-villain/` | Shift and payout tracking — daily payout sheet, monthly sheet, employee directory, late/no-show marks. Users: accounting and admin staff. |

A new folder under `Products/` still needs Bekhruz's sign-off before it's created.

---

## Org context Alex and Timur need to know

- **Oxbridge International School** — private international school in Tashkent, Uzbekistan. Ages 2–18.
- **Two campuses:**
  - **MU (Mirzo-Ulugbek)** — original, ~800 students, senior campus.
  - **YA (Yashnobod)** — purpose-built 2025, new campus, fewer students, more capacity.
- **Three programs the app must understand:**
  - *Futurum* — full IB curriculum (PYP → MYP → DP). English-only.
  - *Hereditum* — enhanced Uzbek state curriculum. Russian + Uzbek + English.
  - *Initium* — kindergarten (ages 2–7). Feeds both Futurum and Hereditum.
- **Total enrollment (April 2026):** ~1,170 students across both campuses. 793 at MU, 377 at YA.
- **Billing model:** monthly tuition, 10-month academic year. First payments due September 2026 — this is the real reason the Parent App must ship by Aug 15.
- **Family relationships:** one parent often has multiple children across grades and campuses. Multi-child households are common. The app must model this from day one.

What devs do NOT need from CLAUDE.md: tuition amounts, pricing strategy, brand voice rules, marketing positioning, parent personas. That stays in Career-Vault.

---

## How work flows here

### For Bekhruz (PM)
1. New product idea or feature → write spec using `_Templates/Spec.md`.
2. Spec lives in the right `Funnel/X/Specs/` folder.
3. Break spec into tasks using `_Templates/Task.md`. Tasks go in `Funnel/X/Tasks/`.
4. Assign tasks by setting the `assignee` field in the task file frontmatter.
5. Review PRs as they come in.

### For Alex and Timur (devs)
1. Pull the PM repo. Read the task file you're assigned.
2. Branch: `task/<task-id>-short-description`.
3. Build in your code repo. PR-per-task in the **code** repo, with `Closes: PM/Funnel/.../Tasks/<task-id>.md` in the description.
4. When done: open a PR against the PM folder that flips the task file frontmatter `status: in_progress` → `status: done` and adds a `## Completion note` section with what shipped.
5. Bekhruz reviews PM PR + code PR, merges.

### For everyone (weekly)
- Friday EOD: team writes `Status/YYYY-WW-{name}.md` from the `_Templates/Status.md` template. 5 minutes, not a chore.

---

## Naming conventions
- Folders: `PascalCase` for top-level (`Funnel/`, `Products/`, `Sprints/`, `Status/`), numbered + kebab for stages (`1-School-site/`), kebab-case for products (`retro-villain/`).
- Files: `kebab-case.md` for content, `_Hub.md` for index files, `_Templates/` and `_Skills/` prefixed with `_`.
- Tasks: `T-{NNN}-short-slug.md` (e.g. `T-001-payments-click-webhook.md`).
- Specs: `kebab-case.md` named by feature surface.
- Decisions: `D-{NNN}-short-slug.md` (e.g. `D-001-auth-stack-choice.md`).

---

## Frontmatter types

Only these. Nothing else.

| Type | Used for |
|---|---|
| `spec` | Feature/product specification |
| `task` | Single buildable work unit |
| `decision` | Architectural or scope decision (ADR-style) |
| `status` | Weekly status from team or PM |
| `sprint` | 2-week plan |
| `hub` | Index file for a folder |

All files should carry frontmatter — see `_Templates/` for the exact shape.

---

## PM skills available

| Skill | Purpose |
|---|---|
| `/pm-status` | Read git history + open tasks + last status logs → produce health snapshot per product |
| `/spec` | Interactive: turn a feature idea into a full spec using the template |
| `/handoff` | Turn a spec into a discrete, assignable task for Alex or Timur |
| `/standup` | Generate a standup summary from recent git activity in the PM folder |
| `/sprint` | Plan the next 2 weeks of work |

Skills live in `_Skills/` and are invoked from anywhere inside this folder.

---

## What Claude should NEVER do in this folder
- Never copy pricing, brand voice, marketing strategy, parent personas, or admissions tactics from Career-Vault into PM files. PM is dev-facing.
- Never write to Career-Vault from a PM session. Cross-folder writes go the other way only (Career-Vault → PM, via copying *relevant* project facts).
- Never edit Linear or assume Linear is the source of truth. PM markdown is.
- Never create files outside the folder structure defined here. If a new shape is needed, propose it to Bekhruz first.
- Never assign work to someone in a task file without Bekhruz explicitly saying so.
- Never delete or modify the `.git/` directory or `.gitignore`.

---

## Key paths
| What | Path |
|---|---|
| PM root | `/Users/thebekhruz/Desktop/Career-Vault/PM` |
| Templates | `/Users/thebekhruz/Desktop/Career-Vault/PM/_Templates/` |
| Skills | `/Users/thebekhruz/Desktop/Career-Vault/PM/_Skills/` |
| Funnel | `/Users/thebekhruz/Desktop/Career-Vault/PM/Funnel/` |
| Products (internal tools) | `/Users/thebekhruz/Desktop/Career-Vault/PM/Products/` |
| Sprints | `/Users/thebekhruz/Desktop/Career-Vault/PM/Sprints/` |
| Status logs | `/Users/thebekhruz/Desktop/Career-Vault/PM/Status/` |

---
*This file is the contract. If something in PM contradicts CLAUDE.md, CLAUDE.md wins until updated.*
