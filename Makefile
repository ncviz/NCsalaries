# R options (--vanilla, but without --no-environ)
R_OPTS=--no-save --no-restore --no-init-file --no-site-file

# Note: salaries.json and salary_ranges.json are generated from R scripts
# These targets are kept for local development but won't work in GitHub deployments
# as they depend on local data files

salary_ranges.json: convert_ranges.R salary_ranges.csv
	R CMD BATCH $(R_OPTS) $<
