##
# Packages
#
install:
	npm ci

build:
	npm run build
	make print-size

test:
	npm test

typecheck:
	npm run typecheck

lint:
	npm run lint

format:
	npx prettier examples/ packages/ modules/ projects/ --write
	npx eslint . --fix

check: build test lint typecheck

##
# Misc.
#
print-size:
	@echo 'SDK package size:'
	@ls -alh packages/sdk/dist/index.mjs | awk '{print $$9 "\t" $$5}'
	@gzip -c packages/sdk/dist/index.mjs | wc -c | awk '{print "index.mjs.gz\t" $$1 " bytes"}'

	@echo 'LocalStorage module size:'
	@ls -alh modules/module-localstorage/dist/index.mjs | awk '{print $$9 "\t" $$5}'
	@gzip -c modules/module-localstorage/dist/index.mjs | wc -c | awk '{print "index.mjs.gz\t" $$1 " bytes"}'
