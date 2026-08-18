# Skills

Domain expertise Claude loads on demand when a task matches. Project-scoped, so
they travel with the repository and work for anyone who clones it — rather than
living in one person's `~/.claude/skills/` on one machine.

Run `node scripts/check-skills.mjs` to validate them; it also runs in the build.

## What is here

**Marketing** — from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)

| Skill | Why it is here |
| --- | --- |
| `pricing` | Gross margin, value metrics, tier structure. Directly next to the pricing engine in `quote-pricing.ts`. |
| `marketing-psychology` | ~70 mental models. Useful for a French-first site aimed at people who have never bought custom packaging. |
| `cro` | Conversion work on the homepage and the waiting-list form. |
| `customer-research` | Interviewing bakeries before guessing what they need. |
| `copywriting` | The site is French-first; the English source copy still has to be worth translating. |

**Brand craft** — from [mike-coulbourn/claude-vibes](https://github.com/mike-coulbourn/claude-vibes)

`brand-naming-strategies` · `brand-archetype-selection` · `brand-color-psychology`
· `brand-messaging-architecture` · `brand-voice-development`
· `tagline-creation-strategies` · `visual-identity-direction`

These map onto what the Brandora interview actually produces — a name, a
palette, a tone of voice, a logo direction — so they are reference material for
the thing the product does, not just for marketing the product.

**Brand building** — from [arnabbagxd/Brand-building-skills](https://github.com/arnabbagxd/Brand-building-skills)

`brand-packaging` · `brand-identity` · `brand-story` · `whatsapp-marketing`
· `d2c-marketing`

`brand-packaging` is the closest thing here to Brandora's actual subject, and
`whatsapp-marketing` matters because WhatsApp is the contact channel the brief
asks to put first for small businesses in Côte d'Ivoire.

## What was deliberately left out, and why

**Every executable file.** The installer copies `*.md` and nothing else, and
`scripts/check-skills.mjs` fails the build if anything non-markdown appears in
here later.

The reason is specific rather than general. `coreyhaines31/marketingskills`
ships `tools/clis/` — about sixty Node scripts that call ZoomInfo, LinkedIn Ads,
GA4, Brevo, Hotjar and others, reading API tokens to do it. There is nothing
wrong with them; Brandora uses none of those services, and a skill runs with the
same tool access as everything else in a repository that holds a database URL.
The five skills taken from that repo are pure markdown and reference none of it.

**The nineteen Anthropic skills** at
[anthropics/skills](https://github.com/anthropics/skills) — `frontend-design`,
`docx`, `xlsx`, `pdf`, `pptx`, `brand-guidelines`, `canvas-design`,
`skill-creator` and the rest. Not copied because they are already available in
this environment; a second copy would only go stale.

**`collectivebrain.de/en/skills/brandkit`** — the host returns 403 from here.

**The rest of the list** — `ui-ux-pro-max`, `impeccable`, `accessibility-review`
and several others are already available here as built-in skills. The remaining
repositories were not installed simply because nothing in Brandora needs them
yet; adding a skill that never triggers costs context at startup and earns
nothing back.

## Adding another

1. Clone it somewhere outside this repository.
2. **Read it** — SKILL.md and every bundled file. Look for network calls, file
   access, and anything that does not match what the skill claims to do.
3. Copy only the markdown into `.claude/skills/<name>/`.
4. `node scripts/check-skills.mjs`.

The frontmatter `name` must match the directory name, be lowercase letters,
numbers and hyphens, and avoid the words "anthropic" and "claude". The check
enforces all of it — a malformed SKILL.md does not error, it simply never loads,
which is worse than not installing it at all.
