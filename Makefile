.PHONY: agents AGENTS.md CLAUDE.md AGENTS.codex.md

agents: AGENTS.md CLAUDE.md AGENTS.codex.md

AGENTS.md:
	vibe out prompts/AGENTS -o AGENTS.md

AGENTS.codex.md:
	vibe out prompts/AGENTS -o AGENTS.codex.md --mode=codex

CLAUDE.md:
	vibe out prompts/AGENTS -o CLAUDE.md