build:
	node scripts/generate-copilot-plugin.mjs --clean

verify-installed:
	node scripts/check-installed-plugin-freshness.mjs --dist dist/agentic-engineering-pack --installed "$(HOME)/.copilot/installed-plugins/_direct/agentic-engineering-pack"

install: build
	mkdir -p "$(HOME)/.copilot/installed-plugins/_direct/agentic-engineering-pack"
	rsync -avc --delete dist/agentic-engineering-pack/ "$(HOME)/.copilot/installed-plugins/_direct/agentic-engineering-pack/"
	$(MAKE) verify-installed

.PHONY: build verify-installed install
