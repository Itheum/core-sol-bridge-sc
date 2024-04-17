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

```
$ anchor test
```