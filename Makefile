##
# Packages
#
install:
	npm ci

clean:
	npm run clean

build:
	npm run build
	make print-size

test:
	npm test

test-browser:
	npm run test:browser

typecheck:
	npm run typecheck

dependency-check:
	npm run dependency-check

lint:
	npm run lint

format:
	npx prettier examples/ packages/ modules/ projects/ --write
	npx eslint . --fix

check: clean build test lint typecheck test-browser dependency-check release-check

release-check: build
	npm run release-check

##
# Misc.
#
print-size:
	npm run bundle-sizes
