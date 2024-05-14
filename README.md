## Install, Build, Deploy and Test

Let's run the test once to see what happens.

### Install `anchor`

First, make sure that `anchor` is installed:

Install `avm`:

```bash
$ cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
...
```

Install latest `anchor` version:

```bash
$ avm install 0.29.0
...
$ avm use 0.29.0
...
```

#### Verify the Installation

Check if Anchor is successfully installed:

```bash
$ anchor --version
anchor-cli 0.29.0
```

### Install Dependencies

Next, install dependencies:

```
$ yarn
```

### Build `bridge-program`

#### Update `program_id`

Get the public key of the deploy key. This keypair is generated automatically so a different key is exptected:

```bash
$ anchor keys list
bridge-program: DRxp3EJv4hGQDze6Evf515KE1YwVgYNv6PiDp1dqF4pK
```

Replace the default value of `program_id` with this new value:

```toml
# Anchor.toml

[programs.localnet]
bridge_program = "DRxp3EJv4hGQDze6Evf515KE1YwVgYNv6PiDp1dqF4pK"

...
```

```rust
// lib.rs

...

declare_id!("DRxp3EJv4hGQDze6Evf515KE1YwVgYNv6PiDp1dqF4pK");

...
```

Build the program:

```
$ anchor build
```

### Deploy `bridge-program`

Let's deploy the program.

```
$ solana config set --url localhost
```

```
$ anchor deploy


Program Id: DRxp3EJv4hGQDze6Evf515KE1YwVgYNv6PiDp1dqF4pK

Deploy success
```

### Test `bridge-program`

To test against localnet, update the `cluster` section in `Anchor.toml`:

```toml
[provider]
cluster = "localnet"
```

Because the program needs a constant admin address, the tests will use the PRIVATE_KEY stored in the `.env` file. This key is used to sign transactions in the tests.
Copy the content from `env.copy` to `.env`.

```
$ anchor test
```

### Admin CLI for `bridge-program`

The admin CLI is a simple rust CLI that can be used to interact with the program admin endpoints. It is located in the `interactions` directory.

To run the CLI, first build it:

```bash
cargo run
```

Run help for the complete list of options:

```bash
cargo run -- --help
```

```
admin-bridge-cli 0.1.0

USAGE:
    admin-bridge-cli [OPTIONS] <SUBCOMMAND>

OPTIONS:
    -C, --config <PATH>        Configuration file to use [default:
                               /Users/bucurdavid/.config/solana/cli/config.yml]
    -h, --help                 Print help information
        --keypair <KEYPAIR>    Filepath or URL to a keypair [default: client keypair]
    -u, --url <URL>            JSON RPC URL for the cluster [default: value from configuration file]
    -v, --verbose              Show additional information
    -V, --version              Print version information

SUBCOMMANDS:
    addLiquidity             Send an add liquidity transaction
    addToWhitelist           Send an add to whitelist transaction
    help                     Print this message or the help of the given subcommand(s)
    initializeContract       Send an initialize contract transaction
    pause                    Send a pause transaction
    removeFromWhitelist      Send a remove from whitelist transaction
    removeLiquidity          Send a remove liquidity transaction
    setDepositLimits         Send a set deposit limits transaction
    setWhitelistActive       Send a set whitelist active transaction
    setWhitelistInactive     Send a set whitelist inactive transaction
    unpause                  Send a unpause transaction
    updateRelayer            Send an update relayer transaction
    updateWhitelistedMint    Send a update whitelisted mint transaction
```

Example:

```bash
cargo run -- pause --url https://api.devnet.solana.com --keypair "usb://ledger?key=0"
```

To sign and send a transaction using ledger Nano S, do the following:

1. `Allow blind signing` in the ledger settings.
2. `Pubkey length` set to `Long` in the ledger settings.
