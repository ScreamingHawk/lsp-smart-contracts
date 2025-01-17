# Contributing

Since the `@lukso/lsp-smart-contracts` is an Open Source project, we welcome contributions from anyone about any topics. You can do PRs or open issues in the repository for instance to:

- discuss and propose new ideas or features.
- report bug and issues.
- introduce new features or bug fixes.

## **Clone project**

Our project uses submodules, we recommend you to clone our repository using the following command:

```bash
$ git clone --recurse-submodules https://github.com/lukso-network/lsp-smart-contracts.git
```

## Linting & Formatting Code

Run the linter and prettier from the _lsp-smart-contracts_ project root:

```bash
npm run linter
npm run prettier
```

The linter is configured to check your code for adherence to our guidelines defined in `.solcover.js`.
The script above will prettify the smart contracts, tests and other files according to our styling guidelines defined in `.prettierrc`.

## **Commits and PRs**

This project uses Conventional Commits to generate release notes and to determine versioning. Commit messages should adhere to this standard and be of the form:

```bash
$ git commit -m "feat: Add new feature x"
$ git commit -m "fix: Fix bug in feature x"
$ git commit -m "docs: Add documentation for feature x"
$ git commit -m "test: Add test suite for feature x"
```

Further details on `conventional commits` can be found here: https://www.conventionalcommits.org/en/v1.0.0/

When merging a branch to `develop` PRs should be squashed into one conventional commit by selecting the `Squash and merge` option. This ensures Release notes are useful and readable when releases are created.

<!-- ![alt text](https://docs.github.com/assets/images/help/pull_requests/select-squash-and-merge-from-drop-down-menu.png) -->
<img src="https://docs.github.com/assets/images/help/pull_requests/select-squash-and-merge-from-drop-down-menu.png" alt="drawing" style="width:600px;"/>

## Adding contributors

You can add yourself to the list of contributors in the repository when opening a PR for the first time in the repository. See the [`all-contributors-cli`](https://allcontributors.org/docs/en/cli/usage#all-contributors-add) usage documentation.
