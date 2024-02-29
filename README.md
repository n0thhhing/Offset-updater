<!-- markdownlint-capture -->
<!-- markdownlint-disable -->

# il2cpp offset updater

this repo utilizes capstone to make patterns and update acording to those patterns

## Prerequisites

-   Required dependencies installed (`chalk`, `typescript`, `Bun`)

## Installation

1. Clone this repository:

    ```bash
    git clone https://github.com/n0thhhing/Offset-updater
    cd Offset-updater
    ```

2. Install dependencies:

    ```bash
    bun install
    ```

### Installing Bun <img src="assets/logo.svg" alt="Bun" class="logo" style="border-radius: 20px; padding: 10px; vertical-align: -15px; translate: -4px; width: 20px; height: 20px;"/>

-   The simplest way to install is found in the official [<kbd>`docs`</kbd>](https://bun.sh/docs/installation)

-   For special cases like Termux, see <span style="margin-right: 5px;">[<kbd>`TERMUX.md` </kbd>](doc/TERMUX.md)</span>

## Usage

1. Open the `config.json` file in the `config` directory and configure the necessary parameters

2. Put the offsets in the offsets.txt file and put your binary files in the specified lib paths you defined in config.json

3. Run the script:

    ```bash
    bun run index.js
    ```

4. The script will update the offsets and log the results.

## Troubleshooting

Feel free to customize and expand upon this based on your specific requirements.

---

**Note:** This is not perfect and relies on the general structure of the bytes to be the same, so if a whole instruction is added, removed, or changed this will fail
