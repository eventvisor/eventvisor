build:
	@npm run build --workspaces
	@make copy-datafiles

copy-datafiles:
	@for dir in projects/*/ ; do \
		project=`basename $$dir` ; \
		mkdir -p datafiles/$$project ; \
		cp $$dir/datafiles/*.json datafiles/$$project/ ; \
	done

	@echo "Datafiles copied to ./datafiles directory successfully."

test:
	npm run test --workspaces

lint:
	npm run lint --workspaces
