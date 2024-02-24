<!-- markdownlint-capture -->
<!-- markdownlint-disable -->

# <img src="../assets/wordmark.svg" alt="Bun" width="75" height="35" style="translate: -4px; vertical-align: -3px;"/>on Termux <img src="../assets/Termux.svg" alt="Bun on Termux" class="termux" style="border-radius: 20px; padding: 10px; vertical-align: -15px; translate: -4px; width: 30px; height: 30px;"/>

Installing Bun on Termux might seem unconventional due to its x64 architecture challenges, but there are workarounds. heres my solution:

```bash
# Install proot-distro for managing Linux distributions
pkg update && pkg install proot-distro -y

# Install Debian for its simplicity in installation and building
proot-distro install debian && proot-distro login debian

# Install bun using the official script
curl -fsSL https://bun.sh/install | bash
```

After the installation, there's an additional step to make bun usable because of a file system issue. Add the following to your shell configuration file (e.g., `~/.bashrc`):

```bash
# Open your preferred text editor to edit the bash configuration
vim ~/.bashrc  # You can use any text editor you prefer

# Add the following lines to create an alias and a function for bun
alias bun=bun_function  # Alternatively, use "alias bun='~/.bun/bin/bun'" if you don't plan on installing things

# function to handle installations with the "--backend=copyfile" flag in order to prevent an "access denied" error when installing packages.
bun_function() {
    if [ "$1" = "add" ]; then
        shift
        ~/.bun/bin/bun add --backend=copyfile "${@}"
    else
        ~/.bun/bin/bun "$@"
    fi
}
```

Then your ready to use bun freely, to verify installation use:

```bash
bun --version
```

For further use outside this repo, see [<kbd>docs</kbd>](https://bun.sh/docs)

Now, your environment is properly configured for executing scripts from this repository.

<br>
<br>

[<kbd> <br> Go Back <img src="../assets/icon.svg" alt="Bun on Termux" class="termux" style="border-radius: 20px; padding: 10px; vertical-align: -15px; translate: -4px; width: 20px; height: 20px;"/><br> </kbd>][KBD]

</div>

<br>
<br>

[KBD]: ../README.md
