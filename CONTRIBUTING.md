# Contributing

Thanks for considering a contribution to Limmud.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue before starting a large feature or behavior change.
3. Keep changes focused; avoid unrelated refactors or dependency upgrades.
4. Never commit course material, personal study data, generated dictionary packs, credentials, or local paths.

## Development

Install the prerequisites and dependencies described in [`README.md`](README.md), then run:

```bash
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Add or update tests for behavior changes. If a check cannot run on your platform, explain that in the pull request.

## Pull requests

- Describe the problem and the smallest solution.
- Include manual verification steps for user-interface changes.
- Add screenshots only when they contain no personal data or licensed course content.
- Update documentation when commands, storage, or user-visible behavior changes.

By contributing, you agree that your contribution is licensed under the MIT License.
