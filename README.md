## Bridge Program

### Abstract

In this repository you will find the bridge program on the Solana side for MultiversX <-> Solana bridge.
The main purpose is to allow users to deposit and lock tokens inside the program liquidity. The relayer service is responsible for the transfer of the tokens between the two blockchains, using bridge liquidity smart contracts on both sides.

### Overview

The bridge program can be directly controlled by an administrator account. The administrator account can perform the following actions:

- Initialize the contract
- Change fee amount
- Change the deposit limits
- Activate/deactivate the program
- Change the relayer address
- Change the whitelisted token
- Activate/Deactivate a user whitelist
- Add/Remove a user from the whitelist
- Add/Remove liquidity

The administrator account is a constant address defined in the `constants.rs` file. There are some workarounds or other solutions to restrict the access of an endpoint to the administrator account, but are more error-prone, so we decided to use a simple solution, a constant address.

The whitelisted relayer address which is stored in the bridge state account is used to restrict the `sendFromLiquidity` endpoint to the relayer address.

### Folder structure

- `programs` - contains the bridge program
- `src` - contains all the source code
- `src/contexts` - contains the program contexts for each endpoint
- `src/states` - contains the program states accounts
- `src/constants` - contains the program constants
- `src/errors` - contains the program custom errors
- `src/lib` - contains the program endpoints

## Install, Build, Deploy and Test

Let's run the test once to see what happens.

### Install `anchor`

First, make sure that `anchor` and the `solana-cli` is installed:

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

install Solana CLI as per here: https://docs.solanalabs.com/cli/install

#### Verify the Installation

Check if Anchor is successfully installed:

```bash
$ anchor --version
anchor-cli 0.29.0

$ solana --version
solana-cli 1.18.15 (src:767d24e5; feat:4215500110, client:SolanaLabs)
```

### Install Dependencies

Next, install dependencies:

```
$ yarn
```

### Build `bridge-program`

Remove any `target` folder if needed or rename if you want to keep it (i.e. version upgrade). You also need to delete it the first time you deploy this program, as only doing this will generate a new program_id needed for next step. For upgrades and followups, you don't need to delete the folder.

```bash
$ anchor build
```

#### Update `program_id`

Get the public key of the deploy key. This keypair is generated automatically so a different key is expected:

```bash
$ anchor keys list
bridge-program: 4wDs9FnvdksFXy69UKVgi7WWqtYJmbM6TiMCEWY9wJz9
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

ALSO, note that you need to "hardcode" the General Admin wallet in constants.rs. This general admin is the one that can call initializeContract.

```
pub const ADMIN_PUBKEY: Pubkey = pubkey!("AxDG4CDKrn8s3a1caY69nQYCjR8YnxqjhMPwhUGFKL2Q");
```

We we re-Build the program: (DO NOT delete the target folder this time before running)

```
$ anchor build
```

### Deploy `bridge-program`

Let's deploy the program using anchor...

```
$ solana config set --url localhost
```

or else, you can update Anchor.toml `cluster = "devnet"` or `mainnet` (mainnet-beta?)

you can also toggle deploying wallet by `wallet = "usb://ledger?key=1"` or `wallet = "~/.config/solana/id.json"`

NOTE: that we can't deploy via Anchor as we found it not too stable, so we used the Solana CLI.

- First, let's generate a new key pair that we will use to deploy the "buffer", once you have it, save it somewhere safe. You will also need a decent amount of SOL in this account (around 3 should do for this program), as it will be used as "rent" for the code. then we set this as the default solana cli wallet for now (or else it will use our standard id.json wallet). Note that on top of setting the custom wallet, you also need to confirm the RPC and config is correct for the mainnet deployment as it defaults to devnet.

Update RPC for devnet/testnet/mainnet by editing the config file here:
`vi /Users/markpaul/.config/solana/cli/config.yml` (and then check via `solana config get`)

Set the default wallet like so:
`solana config set -k /location_of/custom_wallet.json`

The below keys have been backed-up in storage.

[devnet]
`solana config set -k /Users/markpaul/Documents/Source/Software/core-sol-bridge-sc/devnet_interim_first_deployer_wallet_9tSsTbCZEGMgZYALathtBbqmELY7BefFbQQ4gasXGBAo.json`

[mainnet]
`solana config set -k /Users/markpaul/Documents/Source/Software/core-sol-bridge-sc/interim_buffer_deployer_mainnet_FVnq4TFB39W8xEY36rhwFnScpkGzc59jhL3EuFi6K8Nb.json`

- Next, we use this key pair to generate the buffer
  `solana program write-buffer "./target/deploy/bridge_program.so"`

Note that if you don't have enough SOL, then you will see some error like `Error: Account XXX has insufficient funds for spend (2.80402392 SOL) + fee (0.002 SOL)`

In this situation, you need to get more SOL.. but you don't lose what you used, you can do this to close the buffer (note that this closes ALL buffers on this authority -- so if this is not the plan, then you can try and recover the buffer after increasing your SOL. The console should give you tips on how to recover the buffer when the error is hit)
`solana program close --buffers`

if it's a success, the console will give us the buffer like so as an e.g. `Buffer: 85me4UW2ytQmUnzTAHtFvLoZf85D6qhzwgcvUusAByb2`

[devnet]
https://explorer.solana.com/address/85me4UW2ytQmUnzTAHtFvLoZf85D6qhzwgcvUusAByb2?cluster=devnet

[testnet]
`Buffer: 4c5UDi4inDoauN9HShH4CrF5SfEmXxnPAZguKvMK4ocd`
https://explorer.solana.com/address/4c5UDi4inDoauN9HShH4CrF5SfEmXxnPAZguKvMK4ocd?cluster=testnet

[mainnet]
`Buffer: GohVs4cC1WMtTjBgvKA7byWpWsyd9zHy85Z21JtuDPm`
https://explorer.solana.com/address/GohVs4cC1WMtTjBgvKA7byWpWsyd9zHy85Z21JtuDPm

if you notice, the Deploy Authority, is our custom new HOT wallet. Maybe we want to move this to a Cold wallet for security? if so we can do this:

[devnet]
`solana program set-buffer-authority 85me4UW2ytQmUnzTAHtFvLoZf85D6qhzwgcvUusAByb2 --new-buffer-authority 4FeJ53a5QZQFroVgQ5pKFNsu7BEV5AoxHMGhsNKhETYt`

[mainnet]
`solana program set-buffer-authority GohVs4cC1WMtTjBgvKA7byWpWsyd9zHy85Z21JtuDPm --new-buffer-authority 4FeJ53a5QZQFroVgQ5pKFNsu7BEV5AoxHMGhsNKhETYt`

- And finally, we deploy the program from the buffer:
  [devnet]
  `solana program deploy --program-id "./target/deploy/bridge_program-keypair.json" --buffer 85me4UW2ytQmUnzTAHtFvLoZf85D6qhzwgcvUusAByb2 --upgrade-authority "usb://ledger?key=2"`

[mainnet]
`solana program deploy --program-id "./target/deploy/bridge_program-keypair.json" --buffer GohVs4cC1WMtTjBgvKA7byWpWsyd9zHy85Z21JtuDPm --upgrade-authority "usb://ledger?key=2"`

You should finally get the program deployed and see something like:

```
✅ Approved
Program Id: 4wDs9FnvdksFXy69UKVgi7WWqtYJmbM6TiMCEWY9wJz9
```

### Test `bridge-program`

To test against localnet, update the `cluster` section in `Anchor.toml`:

```toml
[provider]
cluster = "localnet"
```

Because the program needs a constant admin address, the tests will use the `UNIT_TEST_PRIVATE_KEY` stored in the `.env` file. This key is used to sign transactions in the tests.
Copy the content from `env.copy` to `.env`. Copy the `UNIT_TEST_PUBLIC_KEY` from the `env.copy` to the `constants.rs` file where the `ADMIN_PUBKEY` constant is defined.

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
                               /Users/<user>/.config/solana/cli/config.yml]
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

### The following commands will bootstrap our program (Check Notion for full steps)

- Step 1: run initializeContract with the params

```bash
cargo run initializeContract --url https://api.devnet.solana.com --keypair <GENERAL_ADMIN_PK> <RELAYER_PUK> <FEE_COLLECTOR_PUK> 0 10000000000 100000000000000 iTHdo2NJbcxy5rKKMwNaffUxZA2zK6DPJirgLgwRkA1

cargo run initializeContract --url https://api.devnet.solana.com --keypair "usb://ledger?key=3" 88Ga1dz27cDXt7srwEy2WtKufA218EgdVGUKjMvTjH4u 93i5uFs7ztSpHcnhTQj8Fr67a3kBedFoMkJUB4b4xdWe 0 10000000000 100000000000000 iTHdo2NJbcxy5rKKMwNaffUxZA2zK6DPJirgLgwRkA1
```

- Step 2: run addLiquidity with the params -- BUT we can do this via the token snippets as well
  cargo run addLiquidity --url https://api.devnet.solana.com --keypair "usb://ledger?key=3"

- Step 3: run unpause when ready

  ```bash
  cargo run relayerUnpause --url https://api.devnet.solana.com --keypair "usb://ledger?key=3"
  ```

- Step 4: run unpause when ready (this is what allows the public to deposit)
  ```bash
  cargo run publicUnpause --url https://api.devnet.solana.com --keypair "usb://ledger?key=3"
  ```
