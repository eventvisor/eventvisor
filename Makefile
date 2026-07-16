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

test-browser:
	npm run test:browser

typecheck:
	npm run typecheck

lint:
	npm run lint

format:
	npx prettier examples/ packages/ modules/ projects/ --write
	npx eslint . --fix

check: build test lint typecheck release-check

release-check: build
	npm run release-check

##
# Misc.
#
print-size:
	npm run bundle-sizes
