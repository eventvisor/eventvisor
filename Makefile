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

lint:
	npx prettier examples/ packages/ modules/ projects/ --check
	npx eslint .
	npx lerna run lint

##
# Misc.
#
print-size:
	@echo 'SDK package size:'
	@gzip -c packages/sdk/dist/index.mjs > packages/sdk/dist/index.mjs.gz
	@ls -alh packages/sdk/dist | grep index.mjs | awk '{print $$9 "\t" $$5}'

	@echo 'LocalStorage module size:'
	@gzip -c modules/module-localstorage/dist/index.mjs > modules/module-localstorage/dist/index.mjs.gz
	@ls -alh modules/module-localstorage/dist | grep index.mjs | awk '{print $$9 "\t" $$5}'
