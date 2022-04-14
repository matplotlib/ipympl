 To release a new version of ipympl on PyPI:

In your local copy  of the repo

1. Switch to the `main` branch
2. Update relevant files
    - `ipympl/_version.py`
    - `src/version.ts`
    - The table in the README
    - The table in `docs/installing.md`
3. `git commit -m "release X.Y.Z"`
4. `git push upstream main`

Then go to github and draft a new release: https://github.com/matplotlib/ipympl/releases/new

In the "Choose a tag" dropdown enter the to be released version and allow it to auto create the tag.

Give the release a title + fill in release details.

Publish - it should now upload automatically to both pypi and npm.
