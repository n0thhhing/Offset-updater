# Testing

## Portable fixture directory

Large real-game binaries and dumps are intentionally excluded from Git. By default,
tests look in the repository's `fixtures/` directory. To keep them on another disk or
copy the test corpus between machines, preserve the directory structure and set:

```bash
export OFFSET_UPDATER_FIXTURES_DIR=/path/to/offset-updater-fixtures
bun run fixtures:status
bun run test:all
```

Users can install the checksum-pinned fixture release directly:

```bash
bun run fixtures:install
```

Set `OFFSET_UPDATER_FIXTURES_DIR` first to install onto an external drive. The installer
refuses to replace an existing `real-game` directory unless explicitly run with
`bun run fixtures:install --force`.

The external directory should contain `real-game/<version>/libil2cpp.so` and
`real-game/<version>/dump/script.json`. The committed manifests pin the expected
binary SHA-256 hashes, so the real-game tests reject incorrect builds. Synthetic and
compiled fixtures may still live under the same external root and can be regenerated.

## Real-game stress test

Run `bun run test:stress` to perform the complete 23.5.2 → 23.7.0 update three
times over the 3,000+ method offset list. Every pass must resolve every entry
except `AppsMenu$$GetDeepLinkArgsFromiOS`,
and its offset and signature files must be byte-for-byte identical to the first
pass. This exercises signature matching and all enabled xref fallbacks against
the full 112 MiB and 129 MiB game libraries. Outputs use a temporary directory
and are removed afterward. The suite skips when its local binaries, dumps, or
offset list are not installed.

The test also maps independently dumped 23.7.0 identities to ELF file offsets
and checks every identifiable generated offset against that oracle. It requires
more than 2,940 methods to resolve directly by byte pattern, preserving a
measured improvement over the portable-mask baseline rather than merely keeping
the final fallback-assisted count stable.

Legacy-labeled entries absent from both dumps are covered by
`tests/manifests/23.5.2-to-23.7.0-obfuscated.json`. Thirty-six AndroidAgent and
IronSource methods are pinned as a preserved relative-layout block with a common
`0x37AD40` relocation; `IronSourceEvents$$InvokeEvent` has a separately pinned
structural fingerprint. The stress test verifies both binary hashes, each source
offset, each destination offset, and the first 48 bytes of decoded instruction
shape. These are relocation checks for historical aliases—the actual dump.cs
methods at those offsets are unrelated, so the manifest does not claim semantic
IronSource/AndroidAgent identity. Together with dump identities, this accounts for every emitted offset;
the single unresolved AppsMenu method is not emitted.

Use `bun run test:stress:verbose` to show load sizes, per-method results,
100-method checkpoints, fallback-phase totals, output activity, and elapsed
times. Normal stress and CLI runs remain quiet; pass `--verbose` to the CLI to
enable the same progress output there.

Ambiguous resolution uses three conservative evidence layers: scanner-compatible
multi-window signatures verified against mnemonic and branch topology, outgoing
call fingerprints tied to already verified methods, and vtable-slot voting that
requires two independent neighboring slots for methods without byte candidates.
No layer accepts a tie, and destination metadata overrides a heuristic result
when an unambiguous dump identity is available.

## Real game regression tests

Run `bun run test:real-game` with `fixtures/real-game/old.so` and `fixtures/real-game/new.so`
installed locally. Both must be little-endian AArch64 ELF64 libraries with
`.text` and `il2cpp` executable sections. Install `llvm-readelf` and `llvm-nm`
and put them on PATH. The suite skips when either binary is absent; unreadable
files, incompatible binaries, missing symbols, and LLVM failures fail setup.

The suite checks:

- The inputs are different builds.
- Nine named exported functions at 48, 80, and 120 bytes: the signature stays
  within the function, matches its exact source offset uniquely, and resolves
  uniquely to the new address independently reported by `llvm-nm`.
- Two internal code windows at old VAs `0x2000024` and `0x20000a4`: 120-byte
  signatures are ambiguous, while 280-byte signatures are unique; the final
  match must also be present in the 120- and 200-byte candidate sets.
- Signature syntax, full requested length, nonempty literal content, instruction
  alignment, and executable section bounds. VA/file-offset translation uses the
  actual containing section in each build.

The internal windows are fixture-specific regression cases, not identified
functions. A unique internal match alone does not establish semantic identity.
When replacing binaries, review their addresses and ambiguity expectations
against independent disassembly. Exported-function tests use symbol addresses
as their independent oracle; tiny branch stubs are excluded to avoid reading
past function boundaries. These tests scan files; they do not launch the game.

## Named gameplay methods (23.4.2 → 23.4.3)

The same command tests 943 named methods using separately extracted
`fixtures/real-game/23.4.2/libil2cpp.so` and `fixtures/real-game/23.4.3/libil2cpp.so`, with each
build's `dump/script.json` alongside its binary. The original 26.11.x fixtures
remain separate. Coverage includes damage, movement, weapons, critical-hit
state, bot health, gadget controls, pets, inventory UI, battle royale, projectiles, damage colliders,
bot movement, quests, weapon pickups, and player synchronization.

`tests/manifests/23.4.2-to-23.4.3.json` records exact addresses taken from each version's
Il2CppDumper `dump/script.json`, plus SHA-256 hashes of the binaries. Tests check
both hashes and verify every saved name/address pair against its matching dump.
Addresses are independent of signature scanning. Four existing overloaded
methods include their dumped parameter signatures to select the exact overload.
Missing or still-ambiguous identities fail the metadata checks.

Each forward test grows a signature until it uniquely matches the source, then
requires exactly the independently dumped destination address. Signatures must
fit within executable sections and both builds' next-known-method boundaries,
with a 2,000-byte cap. A next-method boundary is a guard, not proof of function
size. Missing boundaries fail rather than allowing a guessed method length.

Sixty-four additional methods deliberately remain ambiguous. These include short
8-/12-byte methods, duplicate wrappers, and a case with more than 4,096 matches
that exercises native output overflow. Tests require the correct address among
the candidates, exact fixture-specific match counts, no duplicate/invalid
results, and no signature growth past the boundary. Ambiguity is expected here;
these cases are not counted as successful unique resolutions.

Twenty methods also run in reverse (23.4.3 → 23.4.2), covering player, weapon, bot,
gadget, and pet code. Missing binary fixture groups skip; missing metadata for
an installed group fails setup.

Dumps were generated with the local Il2CppDumper7 tool (metadata version 29).
Create each output directory before running it; a nonexistent output directory
causes this tool to fall back to its own directory. Some other methods remain
obfuscated; selected names are present verbatim in both dumps. When extending
the manifest, derive addresses from both dumps first, then classify signature
results. Keep ambiguous regression cases in `ambiguousMethods`, separate from
uniquely resolvable `methods`.

## 23.4.3 → 23.5.2 regression group

`bun run test:real-game` also loads `fixtures/real-game/23.5.2/libil2cpp.so` and
`fixtures/real-game/23.5.2/dump/script.json`, alongside the existing 23.4.3 fixtures.
The local 23.5.2 files were copied from the extracted APK comparison run; the
suite does not depend on that temporary run directory. To install fixtures on
another machine, extract/dump the matching APK and copy its binary and `dump/script.json` into the version directory.

`tests/manifests/23.4.3-to-23.5.2.json` pins both binary hashes and all 943 method
identities. Two metadata tests validate the saved names, overload signatures,
and addresses against the dumps. The resolver uniquely resolves all 943 methods. It extends a source-unique
signature when the destination remains ambiguous. The reward-completion method
now uses 144 bytes rather than 120, staying within both method boundaries.

For `AccountsMenuItem$$OnEnable`, one register-relative load was replaced by a
direct branch to a two-instruction trampoline. The resolver discovers candidates
from intact signature halves, checks every unchanged instruction, verifies the
displaced load and exact branch back, and requires one unique candidate. Calls,
PC-relative loads, multiple substitutions, invalid/non-executable branch targets,
and ambiguous trampoline candidates are rejected. It exports an independently
unique destination signature and retains the original source signature.

All methods must now resolve exactly to their independently dumped destination
addresses; there are no expected unresolved cases in this build pair.
Expectations are static and are never regenerated during test execution. Two
overloaded signatures use generated type identifier `95` in 23.5.2 where
23.4.3 used `122`; their remaining parameter shapes match, and each version's
exact dumped signature is recorded separately.

## 23.4.2 → 23.5.2 direct jump group

`tests/manifests/23.4.2-to-23.5.2.json` pins the direct multi-version update
from 23.4.2 to 23.5.2 across all 943 methods. All 943 methods resolve uniquely
to their independently dumped 23.5.2 destination addresses, skipping 23.4.3.

The real-game suite now contains **2,949 tests** when all installed fixture groups
are present. The suites skip gracefully if any fixture binary is missing.

## On-demand automation

From the project directory:

```sh
bun run game:test 23.4.2 23.4.3
```

Download each complete ARM64 APK through your browser first. The command finds
`com.pixel.gun3d_VERSION-*.apk` (or `.zip`) in Downloads. APKMirror currently
challenges automated HTTP requests, so the command does not automatically
fetch its download pages. Missing or duplicate downloads produce a clear error.
For differently named APKs, use:

```sh
bun run game:test 23.4.2 23.4.3 --old-apk /path/to/old.apk --new-apk /path/to/new.apk
```

The version arguments label the inputs; use APKs from those exact releases.
Requires Python 3.9+, Bun, `llvm-readelf` on PATH, and the local
`dotnet_sdk/dotnet` and `Il2CppDumper7` folders. No additional Python packages
are needed. Use `--downloads /path/to/folder` to change the search directory.

Each invocation creates a fresh `real_game/runs/OLD-to-NEW-*/` directory with
extracted files, dumps, dumper logs, input hashes, and `report.json`. It preserves
existing fixtures, regression expectations, and the original dumper config.
Protected metadata stops the command before it can claim a validated result.

The unique-resolution method names come from `tests/gameplay-targets.json`; expected
addresses are freshly derived from each APK's dump. Fixed signature lengths
48/80/120/200/280 are tried up to the next known method boundary, stopping at
the first unique correct result. Each attempt records ambiguity, missing
matches, or a unique wrong address. Missing/overloaded method names require
review. Exit code zero means every selected method resolved uniquely to its
independent expected address; any unresolved method produces exit code one.
The automation uses its fixed-length search policy, which differs from the
regression suite’s dynamic growth; it may report unresolved methods on other
builds or lengths. Ambiguity regression cases are excluded from this automation.
These are binary offset checks, not tests that launch or play the game.
