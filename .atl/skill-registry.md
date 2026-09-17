# Skill Registry — pos

## Installed Skills (locked via `skills-lock.json`)

| Skill Name | Source | Source Type | Skill Path |
|---|---|---|---|
| mysql | planetscale/database-skills | github | .agents/skills/mysql/SKILL.md |
| prisma-database-setup | prisma/skills | github | .agents/skills/prisma-database-setup/SKILL.md |
| vercel-react-best-practices | vercel-labs/agent-skills | github | .agents/skills/vercel-react-best-practices/SKILL.md |

## Project-Level Skills (`.agents/skills/`)

| Skill | Description | Path |
|---|---|---|
| mysql | MySQL/InnoDB schema, indexing, tuning, transactions | `.agents/skills/mysql/SKILL.md` |
| prisma-database-setup | Prisma DB provider configuration guides | `.agents/skills/prisma-database-setup/SKILL.md` |
| vercel-react-best-practices | React/Next.js perf optimization (Vercel Eng) | `.agents/skills/vercel-react-best-practices/SKILL.md` |

## Convention Files

| File | Role |
|---|---|
| `CLAUDE.md` | Project AI context — stack, commands, architecture, patterns |
| `.agents/skills/vercel-react-best-practices/AGENTS.md` | Skill index with section references |

## Notes

- SDD skills (`sdd-apply`, `sdd-archive`, `sdd-design`, `sdd-explore`, `sdd-init`, `sdd-onboard`, `sdd-propose`, `sdd-spec`, `sdd-tasks`, `sdd-verify`) excluded from registry (managed via SDD workflow)
- OpenCode config-level skills (branch-pr, chained-pr, officecli-*, etc.) available via `~/.config/opencode/skills/`
- Skill registry persisted to Engram as `skill-registry` (topic_key) for cross-session recovery
