# IL2CPP Offset Updater

High-performance AArch64 IL2CPP offset updater that tracks method locations across binary updates using disassembler-guided wildcard signatures, verified load-trampoline matching, and an optimized ARM NEON SIMD scanning engine.

## Features

- **AArch64 Disassembly & Wildcarding**: Disassembles instructions via Capstone to keep stable opcodes, conditions, and registers while masking volatile page offsets, relative branch immediates, and data offsets.
- **Dynamic Signature Growth**: Generates compact signatures (starting at 48 bytes) and incrementally expands only when necessary to disambiguate candidates.
- **IL2CPP Metadata Triangulation (Auto-Anchoring)**: Automatically resolves heavily ambiguous methods (like generic 1-liners) when requested in isolation by dynamically scanning `.rodata` for IL2CPP `MethodInfo` pointer arrays, silently resolving adjacent siblings, and using them to triangulate the requested method without requiring manual anchors.
- **Trampoline & Detour Resolution**: Automatically validates direct branch detours and relocated load instructions across binary updates.
- **Native Analysis Engine**: Uses ARM NEON and libdispatch for parallel pattern scans, rodata indexing, control-flow verification, and call-graph extraction, with automatic TypeScript fallbacks.
- **Comprehensive Verification**: Validated across synthetic libraries, compiled C fixtures, and real-game builds with thousands of regression assertions.

## Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- `clang++` (optional, for compiling the native ARM NEON scanner)
- `llvm-nm` and `llvm-readelf` (optional, for running compiled and real-game test suites)

## Installation

```bash
git clone https://github.com/n0thhhing/Offset-updater.git
cd Offset-updater
bun install
bun run build:native
```

## Usage

1. Configure your target libraries and offsets in `config/config.json`:

```json
{
  "oldLibrary": "path/to/old/libil2cpp.so",
  "newLibrary": "path/to/new/libil2cpp.so",
  "offsets": "path/to/offsets.txt",
  "offsetOutput": "dist/offsets.txt",
  "signatureOutput": "dist/signatures.txt",
  "signatureLength": 300
}
```

2. Specify your known source offsets in `offsets.txt`:

```text
0x491FEA0 -- Player_GetHealth
0x491F3B4 -- GameManager_GetInstance
```

3. Run the updater:

```bash
bun run start
# Or specify a custom config file:
bun run start path/to/custom-config.json
# Opt in to detailed progress and resolution diagnostics:
bun run start path/to/custom-config.json --verbose
```

4. The updated offsets and extracted signatures are written to `dist/offsets.txt` and `dist/signatures.txt`.

## Scripts

| Command                     | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `bun run start`             | Run the updater CLI using `config/config.json`            |
| `bun run build:native`      | Compile the native C++ SIMD scanner library               |
| `bun run test`              | Run unit and integration test suites                      |
| `bun run test:unit`         | Run unit tests for wildcards, scanner, and resolver       |
| `bun run test:integration`  | Run integration tests on synthetic and compiled libraries |
| `bun run test:real-game`    | Run real-game binary regression suite                     |
| `bun run test:stress`       | Run deterministic full-update stress and oracle checks    |
| `bun run test:all`          | Run all test suites                                       |
| `bun run typecheck`         | Run TypeScript strict type-checking (`tsc --noEmit`)      |
| `bun run format`            | Format codebase using Prettier                            |
| `bun run format:check`      | Verify codebase formatting                                |
| `bun run fixtures:generate` | Regenerate synthetic binary fixtures                      |
| `bun run fixtures:compile`  | Recompile C test fixtures imitating IL2CPP structures     |
| `bun run fixtures:status`   | Show the active portable fixture root and missing files   |
| `bun run fixtures:install`  | Download and verify the real-game fixture release         |
| `bun run fixtures:package`  | Build the maintainer fixture release archive              |
| `bun run manifest:generate` | Generate and verify a test manifest between two versions  |
| `bun run offsets:diff`      | Diff and display offset changes between two offset files  |

## Project Structure

```text
Offset-updater/
├── config/              # Configuration files
├── dist/                # Output directory for resolved offsets & signatures
├── docs/                # Extended documentation and testing notes
├── fixtures/
│   ├── compiled/        # Compiled C fixtures imitating IL2CPP (gitignored)
│   ├── generated/       # Synthetic binary fixtures (gitignored)
│   └── real-game/       # Real-game binaries and dumps (gitignored)
├── native/              # ARM NEON SIMD C++ scanning engine & build script
├── scripts/             # Fixture generation and compilation utilities
├── src/
│   ├── binary/          # ELF segment parsing, branch targets, and dump metadata
│   ├── io/              # Configuration, file reading, and output formatters
│   ├── patterns/        # Disassembly wildcarding, signature generation, and scan
│   ├── cli.ts           # CLI entry point
│   ├── disassembler.ts  # Capstone disassembler wrapper
│   ├── index.ts         # Public API exports
│   └── updater.ts       # Core offset update workflow
└── tests/
    ├── integration/     # Integration tests on compiled & synthetic libraries
    ├── manifests/       # Pinned method manifests & build hashes
    ├── real-game/       # Real-game regression test suite
    ├── support/         # Test fixture generators and helpers
    └── unit/            # Unit tests for wildcards, resolver, and scanner
```
