# github>zrr1999/renovate-config

My shareable config for Renovate

## Setup

Enable Renovate in your repo and just extends in renovate.json.

```jsonc
{
   "extends": ["github>zrr1999/renovate-config"],
}
```

## prek hooks

The preset updates GitHub hook revisions in root and nested `prek.toml` files.
Tag references are read as TOML, including reordered keys and single quotes.
SHA references use the conventional layout below so Renovate can update both
the commit and its `frozen` tag while retaining the pin:

```toml
[[repos]]
repo = "https://github.com/tombi-toml/tombi-pre-commit"
rev = "3251597d6d00583a75057ea11da9fcb66a588198" # frozen: v1.5.5
hooks = [{ id = "tombi-format" }]
```

For frozen references, keep `repo` and then `rev` as the first two keys of the
table; blank lines and comments are allowed between them. GitHub HTTPS URLs
with an optional `.git` suffix or trailing slash are supported. Unlabelled SHAs,
non-GitHub repositories, local/builtin hooks, and `additional_dependencies` are
outside this support. Lychee's `lychee-vX.Y.Z` tags use a dedicated version rule.

Repositories that restrict `enabledManagers` must include `custom.jsonata` and
`custom.regex`. The existing schedule, grouping and automerge rules still apply.
This custom support can be replaced when Renovate's
[native prek manager](https://github.com/renovatebot/renovate/pull/42254) is available.

### Validation

Run the config validator and the extraction/update regression checks against the
same Renovate version. The checks use Renovate's actual managers and updater,
with all file writes isolated in a temporary directory:

```sh
vpx -p node@24.15.0 -p renovate@44.176.2 -c 'renovate-config-validator --no-global default.json'
vpx -p node@24.15.0 -p renovate@44.176.2 -c 'node tests/prek.mjs "$(command -v renovate)"'
```

## References

- [SigureMo's config](https://github.com/SigureMo/renovate-config)
- [Renovate Docs](https://docs.renovatebot.com/)
- [Config Presets | Renovate Docs](https://docs.renovatebot.com/config-presets/)
- [@teppeis/renovate-config](https://github.com/teppeis/renovate-config)
