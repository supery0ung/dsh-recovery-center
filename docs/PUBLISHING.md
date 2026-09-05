# Release and catalog submission

1. Run `npm run check` with Node.js 22 and verify the isolated DSH restore flow.
2. Inspect `npm pack --dry-run`. Only plugin code, metadata, README and license belong in the package; never include runtime data, recovery points or credentials.
3. Publish source at https://github.com/supery0ung/dsh-recovery-center and the package on npm.
4. Add the `dsh-plugin` GitHub topic.
5. Once the repository is at least one day old, submit one YAML file at `data/plugins/supery0ung__dsh-recovery-center.yml` to https://github.com/awesome-dsh-plugin/awesome-dsh-plugin following its current contributing.md.
6. Catalog acceptance requires maintainer review. Publishing an npm package alone does not guarantee a store listing.
