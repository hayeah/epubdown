.PHONY: agents AGENTS.md CLAUDE.md

agents: AGENTS.md CLAUDE.md

AGENTS.md:
	vibe out prompts/AGENTS.md -o AGENTS.md

CLAUDE.md:
	vibe out prompts/AGENTS.md -o CLAUDE.md