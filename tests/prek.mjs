import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = dirname(await realpath(process.argv[2]))
const load = (path) => import(pathToFileURL(join(dist, path)))
const { extractPackageFile } = await load('modules/manager/index.js')
const { doAutoReplace } = await load('workers/repository/update/branch/auto-replace.js')
const { GlobalConfig } = await load('config/global.js')
const { parse: parseToml } = await load('util/toml.js')
const { init } = await load('logger/index.js')
const { applyPackageRules } = await load('util/package-rules/index.js')
const { get: getVersioning } = await load('modules/versioning/index.js')
await init()
const preset = JSON.parse(await readFile(new URL('../default.json', import.meta.url), 'utf8'))
const localDir = await mkdtemp(join(tmpdir(), 'renovate-prek-'))
GlobalConfig.set({ localDir })

const content = `# rev = "v1.0.0" is also present in comments and unrelated hooks.
[[repos]]
repo = "builtin"
hooks = [{ id = "check-toml" }]

[[repos]]
repo = 'https://github.com/example/first.git/'
rev = 'v1.0.0'
hooks = []

[[repos]]
rev = "v1.0.0" # TOML key order is not significant.
repo = "https://github.com/example/second"
hooks = []

[[repos]] # frozen refs retain the digest and tag
# A comment before the repo.
repo = 'https://github.com/example/pinned.git' # source

# A comment before the rev.
rev = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'  # frozen: v1.0.0
hooks = []

[[repos]]
repo = "https://github.com/example/unlabelled-sha"
rev = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
hooks = []

[[repos]]
repo = "https://github.com/example/short-sha"
rev = "abcdef1"
hooks = []

[[repos]]
repo = "https://gitlab.com/example/hook"
rev = "v1.0.0"
hooks = []

[[repos]]
repo = "local"
hooks = [{ id = "local", entry = "tool v1.0.0", language = "system" }]
`

try {
  const lychee = await applyPackageRules({
    depName: 'lycheeverse/lychee',
    packageName: 'lycheeverse/lychee',
    depType: 'prek',
    packageRules: preset.packageRules,
  })
  const versioning = getVersioning(lychee.versioning)
  assert(versioning.isGreaterThan('lychee-v0.25.0', 'lychee-v0.24.2'))
  assert.equal(versioning.isVersion('lychee-lib-v9.0.0'), false)
  assert.equal(versioning.isVersion('v9.0.0'), false)

  for (const custom of preset.customManagers) {
    const manager = custom.customType
    for (const source of [content, content.replaceAll('\n', '\r\n')]) {
      const extracted = await extractPackageFile(manager, source, 'prek.toml', custom)
      const deps = extracted.deps
      assert.deepEqual(
        deps.map(({ depName, currentValue, currentDigest }) => ({
          depName,
          currentValue,
          currentDigest,
        })),
        custom.customType === 'jsonata'
          ? ['first', 'second'].map((name) => ({
              depName: `example/${name}`,
              currentValue: 'v1.0.0',
              currentDigest: undefined,
            }))
          : [
              {
                depName: 'example/pinned',
                currentValue: 'v1.0.0',
                currentDigest: 'a'.repeat(40),
              },
            ]
      )

      for (const [depIndex, dep] of deps.entries()) {
        const newDigest = dep.currentDigest ? 'c'.repeat(40) : undefined
        const updated = await doAutoReplace(
          {
            ...custom,
            ...dep,
            manager,
            packageFile: 'prek.toml',
            depIndex,
            newValue: 'v1.1.0',
            newDigest,
            autoReplaceGlobalMatch: true,
          },
          source,
          false
        )
        const expected = parseToml(source)
        const index = { 'example/first': 1, 'example/second': 2, 'example/pinned': 3 }[dep.depName]
        expected.repos[index].rev = newDigest ?? 'v1.1.0'
        assert.deepEqual(parseToml(updated), expected)
        const reextracted = await extractPackageFile(manager, updated, 'prek.toml', custom)
        assert.equal(reextracted.deps[depIndex].currentValue, 'v1.1.0')
        assert.equal(reextracted.deps[depIndex].currentDigest, newDigest)
      }
    }
  }
  console.log(
    'prek extraction and updates passed (tags, frozen SHAs, CRLF, duplicate versions, exclusions)'
  )
} finally {
  await rm(localDir, { recursive: true, force: true })
}
