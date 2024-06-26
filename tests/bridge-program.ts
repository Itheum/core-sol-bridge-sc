import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {BridgeProgram} from '../target/types/bridge_program'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createWrappedNativeAccount,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getOrCreateAssociatedTokenAccount,
  MINT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token'
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {Keypair} from '@solana/web3.js'
import {assert, expect} from 'chai'

require('dotenv').config()

describe('bridge-program', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const provider = anchor.getProvider()
  const program = anchor.workspace.BridgeProgram as Program<BridgeProgram>

  const connection = provider.connection

  const PRIVATE_KEY_STR = process.env.UNIT_TEST_PRIVATE_KEY
  const privateKeys = PRIVATE_KEY_STR.split(',').map(Number)

  const [user, user2, itheum_token_mint, another_token_mint, fee_collector] =
    Array.from({length: 5}, () => Keypair.generate())

  const itheum_token_user_ata = getAssociatedTokenAddressSync(
    itheum_token_mint.publicKey,
    user.publicKey
  )
  const another_token_user_ata = getAssociatedTokenAddressSync(
    another_token_mint.publicKey,
    user.publicKey
  )

  const itheum_token_user2_ata = getAssociatedTokenAddressSync(
    itheum_token_mint.publicKey,
    user2.publicKey
  )
  const another_token_user2_ata = getAssociatedTokenAddressSync(
    another_token_mint.publicKey,
    user2.publicKey
  )

  const admin = Keypair.fromSecretKey(Uint8Array.from(privateKeys))

  console.log(admin.publicKey.toBase58())

  const itheum_token_admin_ata = getAssociatedTokenAddressSync(
    itheum_token_mint.publicKey,
    admin.publicKey
  )
  const another_token_admin_ata = getAssociatedTokenAddressSync(
    another_token_mint.publicKey,
    admin.publicKey
  )

  const bridgeStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from('bridge_state')],
    program.programId
  )[0]

  const user2WhitelistPda = PublicKey.findProgramAddressSync(
    [user2.publicKey.toBuffer(), bridgeStatePda.toBuffer()],
    program.programId
  )[0]

  const vault_ata = getAssociatedTokenAddressSync(
    itheum_token_mint.publicKey,
    bridgeStatePda,
    true
  )

  const fee_collector_ata = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    fee_collector.publicKey,
    true
  )

  const another_token_vault_ata = getAssociatedTokenAddressSync(
    another_token_mint.publicKey,
    bridgeStatePda,
    true
  )

  let user_wsol_ata: PublicKey
  let user2_wsol_ata: PublicKey

  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      signature,
      ...block,
    })

    return signature
  }

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    )
    return signature
  }

  before('Airdrop and create mints', async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(connection)

    let tx2 = new Transaction()
    tx2.instructions = [
      ...[admin, fee_collector].map((k) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[itheum_token_mint, another_token_mint].map((m) =>
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: m.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      ),
      ...[
        [itheum_token_mint.publicKey, admin.publicKey, itheum_token_admin_ata],
        [
          another_token_mint.publicKey,
          admin.publicKey,
          another_token_admin_ata,
        ],
      ].flatMap((x) => [
        createInitializeMint2Instruction(x[0], 9, x[1], x[1]),
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          x[2],
          x[1],
          x[0],
          TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(x[0], x[2], x[1], 1000e9),
      ]),
    ]
    await provider
      .sendAndConfirm(tx2, [admin, itheum_token_mint, another_token_mint])
      .then(log)

    let tx = new Transaction()
    tx.instructions = [
      ...[user, user2].map((k) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[
        [itheum_token_mint.publicKey, user.publicKey, itheum_token_user_ata],
        [another_token_mint.publicKey, user.publicKey, another_token_user_ata],
        [itheum_token_mint.publicKey, user2.publicKey, itheum_token_user2_ata],
        [
          another_token_mint.publicKey,
          user2.publicKey,
          another_token_user2_ata,
        ],
      ].flatMap((x) => [
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          x[2],
          x[1],
          x[0],
          TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(x[0], x[2], admin.publicKey, 100e9),
      ]),
    ]

    await provider.sendAndConfirm(tx, [admin])

    let wrapSol = [user, user2]

    let accounts = await Promise.all(
      wrapSol.map(async (k) => {
        const account = await createWrappedNativeAccount(
          connection,
          k,
          k.publicKey,
          5 * LAMPORTS_PER_SOL
        )
        return account
      })
    )

    user_wsol_ata = accounts[0]
    user2_wsol_ata = accounts[1]
  })

  it('Send to liquidity by user - bridge state not initialized (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          whitelist: null,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(3012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'The program expected this account to be already initialized'
      )
    }
  })

  it('Initialize contract by user (should fail)', async () => {
    try {
      await program.methods
        .initializeContract(
          user.publicKey,
          fee_collector.publicKey,
          new anchor.BN(0),
          new anchor.BN(0),
          new anchor.BN(2)
        )
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenWhitelisted: itheum_token_mint.publicKey,
          authority: user.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Initialize contract by admin', async () => {
    await program.methods
      .initializeContract(
        admin.publicKey,
        fee_collector.publicKey,
        new anchor.BN(0),
        new anchor.BN(0),
        new anchor.BN(1000e10)
      )
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenWhitelisted: itheum_token_mint.publicKey,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)
    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 0)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)

    let vault = await getAccount(connection, vault_ata)

    assert(vault.mint.equals(itheum_token_mint.publicKey))
    assert(vault.owner.equals(bridgeStatePda))
  })

  it('Change whitelist by user (should fail)', async () => {
    try {
      await program.methods
        .updateWhitelistedMint()
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
          vault: another_token_vault_ata,
          mintOfTokenWhitelisted: another_token_mint.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Change relayer whitelist by user (should fail)', async () => {
    try {
      await program.methods
        .updateRelayer(user2.publicKey)
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user2.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Change fee collector by user (should fail)', async () => {
    try {
      await program.methods
        .updateFeeCollector(fee_collector.publicKey)
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Change fee amount by user (should fail)', async () => {
    try {
      await program.methods
        .setFeeAmount(new anchor.BN(1000e9))
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Change fee collector by admin', async () => {
    await program.methods
      .updateFeeCollector(fee_collector.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.feeCollector.equals(fee_collector.publicKey))
  })

  it('Change whitelist and relayer by admin ', async () => {
    await program.methods
      .updateWhitelistedMint()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
        vault: vault_ata,
        mintOfTokenWhitelisted: itheum_token_mint.publicKey,
      })
      .rpc()

    await program.methods
      .updateRelayer(admin.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 0)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)
  })

  it('Add liquidity by user (should fail)', async () => {
    try {
      await program.methods
        .addLiquidity(new anchor.BN(100e9))
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Add liquidity by admin - not whitelisted mint (should fail)', async () => {
    try {
      await program.methods
        .addLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: another_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: another_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  it('Add liquidity by admin - wrong(mint) admin ATA (should fail)', async () => {
    try {
      await program.methods
        .addLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: another_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6007)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Mint mismatch'
      )
    }
  })

  it('Add liquidity by admin - wrong(owner) admin ATA (should fail)', async () => {
    try {
      await program.methods
        .addLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Add liquidity by admin - wrong amount (should fail)', async () => {
    try {
      await program.methods
        .addLiquidity(new anchor.BN(3000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: itheum_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Add liquidity by admin', async () => {
    await program.methods
      .addLiquidity(new anchor.BN(1000e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        authorityTokenAccount: itheum_token_admin_ata,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 1000e9)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 1000e9)
  })

  it('Remove liquidity by user (should fail)', async () => {
    try {
      await program.methods
        .removeLiquidity(new anchor.BN(100e9))
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 1000e9)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 1000e9)
  })

  it('Remove liquidity by admin - wrong whitelisted mint (should fail)', async () => {
    try {
      await program.methods
        .removeLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: another_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: another_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  it('Remove liquidity by admin - wrong(mint) admin ATA (should fail)', async () => {
    try {
      await program.methods
        .removeLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: another_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6007)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Mint mismatch'
      )
    }
  })

  it('Remove liquidity by admin - wrong(owner) admin ATA (should fail)', async () => {
    try {
      await program.methods
        .removeLiquidity(new anchor.BN(1000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6006)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Owner mismatch'
      )
    }
  })

  it('Remove liquidity by admin - wrong amount (should fail)', async () => {
    try {
      await program.methods
        .removeLiquidity(new anchor.BN(3000e9))
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          authorityTokenAccount: itheum_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Remove liquidity by admin', async () => {
    await program.methods
      .removeLiquidity(new anchor.BN(500e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        authorityTokenAccount: itheum_token_admin_ata,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 500e9)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 500e9)
  })

  it('Remove liquidity by admin', async () => {
    await program.methods
      .removeLiquidity(new anchor.BN(500e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        authorityTokenAccount: itheum_token_admin_ata,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
    assert(bridgeState.vault.equals(vault_ata))
    assert(bridgeState.vaultAmount.toNumber() === 0)
    assert(
      bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)
    )
    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)

    let adminAta = await getAccount(connection, itheum_token_admin_ata)

    assert(Number(adminAta.amount) == 1000e9)

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 0)
  })

  it('Pause contract by user (should fail)', async () => {
    try {
      await program.methods
        .publicPause()
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6004)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not privileged'
      )
    }
  })

  it('Pause contract by admin', async () => {
    await program.methods
      .publicPause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    await program.methods
      .relayerPause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerState === 0)
    assert(bridgeState.publicState === 0)
  })

  it('Unpause contract by user (should fail)', async () => {
    try {
      await program.methods
        .publicPause()
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6004)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not privileged'
      )
    }
  })

  it('Unpause contract by admin - public', async () => {
    await program.methods
      .publicUnpause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.publicState === 1)
  })

  it('Unpause contract by admin - relayer', async () => {
    await program.methods
      .relayerUnpause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerState === 1)
  })

  it('Send from liquidity by user (should fail)', async () => {
    await program.methods
      .addLiquidity(new anchor.BN(1000e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        authorityTokenAccount: itheum_token_admin_ata,
      })
      .rpc()

    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(1000e9), user.publicKey)
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          receiverTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6004)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not privileged'
      )
    }
  })

  it('Send from liquidity by relayer - wrong amount (should fail)', async () => {
    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(3000e9), user.publicKey)
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          receiverTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Send from liquidity by relayer - wrong whitelisted mint (should fail)', async () => {
    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(1000e9), user.publicKey)
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: another_token_mint.publicKey,
          authority: admin.publicKey,
          receiverTokenAccount: itheum_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  it('Send from liquidity by relayer - wrong(mint) user ATA (should fail)', async () => {
    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(1000e9), user.publicKey)
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          receiverTokenAccount: another_token_user_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6007)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Mint mismatch'
      )
    }
  })

  it('Send from liquidity by relayer - wrong(owner) user ATA (should fail)', async () => {
    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(1000e9), user.publicKey)
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          receiverTokenAccount: itheum_token_admin_ata,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6006)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Owner mismatch'
      )
    }
  })

  it('Change relayer address by admin', async () => {
    await program.methods
      .updateRelayer(user2.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(user2.publicKey))
  })

  it('Pause relayer by relayer - (should fail)', async () => {
    try {
      await program.methods
        .relayerPause()
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user2.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6004)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not privileged'
      )
    }
  })

  it('Unpause relayer by relayer - (should fail)', async () => {
    try {
      await program.methods
        .relayerUnpause()
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user2.publicKey,
        })
        .rpc()
      assert(false, 'Should have thrown error')
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6004)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not privileged'
      )
    }
  })

  it('Change relayer address by admin', async () => {
    await program.methods
      .updateRelayer(admin.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.relayerPubkey.equals(admin.publicKey))
  })

  it('Send from liquidity by relayer - paused relayer (should fail)', async () => {
    await program.methods
      .relayerPause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    try {
      await program.methods
        .sendFromLiquidity(new anchor.BN(100e9), user.publicKey)
        .signers([admin])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: admin.publicKey,
          receiverTokenAccount: itheum_token_user_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6000)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Program is paused'
      )
    }
  })

  it('Send from liquidity by relayer to user', async () => {
    await program.methods
      .relayerUnpause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    await program.methods
      .sendFromLiquidity(new anchor.BN(100e9), user.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        receiverTokenAccount: itheum_token_user_ata,
      })
      .rpc()

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 900e9)

    let userAta = await getAccount(connection, itheum_token_user_ata)

    assert(Number(userAta.amount) == 200e9) // 100e9 was already in user's account

    let bridge = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridge.vaultAmount.toNumber() == 900e9)
  })

  it('Send to liquidity by user - paused public (should fail)', async () => {
    await program.methods
      .publicPause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          whitelist: null,
          authorityTokenAccount: itheum_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6000)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Program is paused'
      )
    }
  })

  it('Sent to liquidity by user - wrong amount (should fail)', async () => {
    await program.methods
      .publicUnpause()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(1000e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Send to liquidity by user - wrong whitelisted mint (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: another_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  it('Send to liquidity by user - wrong(mint) user ATA (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: another_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6007)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Mint mismatch'
      )
    }
  })

  it('Send to liquidity by user - wrong(owner) user ATA (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_admin_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Set whitelist active', async () => {
    await program.methods
      .setWhitelistActive()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.whitelistState == 1)
  })

  it('Send to liquidity by user - not whitelisted (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(200e9), 'erd...', 'signature')
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user.publicKey,
          authorityTokenAccount: itheum_token_user_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6002)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not whitelisted'
      )
    }
  })

  it('Set whitelist inactive', async () => {
    await program.methods
      .setWhitelistInactive()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.whitelistState == 0)
  })

  it('Send to liquidity by user', async () => {
    await program.methods
      .sendToLiquidity(new anchor.BN(200e9), 'erd...', 'signature')
      .signers([user])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        whitelist: null,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: user.publicKey,
        authorityTokenAccount: itheum_token_user_ata,
        feeCollector: null,
        mintOfFeeTokenSent: null,
        authorityFeeTokenAccount: null,
        feeCollectorAta: null,
      })
      .rpc()

    let vault = await getAccount(connection, vault_ata)

    assert(Number(vault.amount) == 1100e9)

    let userAta = await getAccount(connection, itheum_token_user_ata)

    assert(Number(userAta.amount) == 0e9)

    let bridge = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridge.vaultAmount.toNumber() == 1100e9)
  })

  it('Set whitelist active', async () => {
    await program.methods
      .setWhitelistActive()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.whitelistState == 1)
  })

  it('Add to whitelist by user - wrong(signer) (should fail)', async () => {
    try {
      await program.methods
        .addToWhitelist(user2.publicKey)
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          whitelistEntry: user2WhitelistPda,
          authority: user2.publicKey,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Send to liquidity by user2 - whitelist provided but not whitelisted (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(50e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: user2WhitelistPda,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (error) {
      expect((error as anchor.AnchorError).error.errorCode.number).to.equal(
        3012
      )
      expect((error as anchor.AnchorError).error.errorMessage).to.equal(
        'The program expected this account to be already initialized'
      )
    }
  })

  it('Add to whitelist by admin', async () => {
    await program.methods
      .addToWhitelist(user2.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        whitelistEntry: user2WhitelistPda,
        authority: admin.publicKey,
      })
      .rpc()

    let whitelistFetch = await program.account.whitelistEntry.fetch(
      user2WhitelistPda
    )

    assert(
      whitelistFetch.whitelistAddress.toBase58() == user2.publicKey.toBase58()
    )
  })

  it('Send to liquidity by user2 - whitelist account not provided (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(50e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6002)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not whitelisted'
      )
    }
  })

  it('Send to liquidity by user2', async () => {
    await program.methods
      .sendToLiquidity(new anchor.BN(50e9), 'erd...', 'signature')
      .signers([user2])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        whitelist: user2WhitelistPda,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: user2.publicKey,
        authorityTokenAccount: itheum_token_user2_ata,
        feeCollector: null,
        mintOfFeeTokenSent: null,
        authorityFeeTokenAccount: null,
        feeCollectorAta: null,
      })
      .rpc()

    let whitelistAcc = await program.account.whitelistEntry.fetch(
      user2WhitelistPda
    )

    assert(whitelistAcc.whitelistAddress.equals(user2.publicKey))
  })

  it('Remove from whitelist by user2 - wrong(signer) (should fail)', async () => {
    try {
      await program.methods
        .removeFromWhitelist(user2.publicKey)
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          whitelistEntry: user2WhitelistPda,
          authority: user2.publicKey,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Remove from whitelist by admin', async () => {
    await program.methods
      .removeFromWhitelist(user2.publicKey)
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        whitelistEntry: user2WhitelistPda,
        authority: admin.publicKey,
      })
      .rpc()
  })

  it('Set deposit limits by user - wrong(signer) (should fail)', async () => {
    try {
      await program.methods
        .setDepositLimits(new anchor.BN(100e9), new anchor.BN(200e9))
        .signers([user])
        .accounts({
          bridgeState: bridgeStatePda,
          authority: user.publicKey,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Set deposit limits by admin', async () => {
    await program.methods
      .setDepositLimits(new anchor.BN(100e9), new anchor.BN(200e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.minimumDeposit.toNumber() == 100e9)
    assert(bridgeStateFetch.maximumDeposit.toNumber() == 200e9)
  })

  it('Send to liquidity by user2 - payment amount not in range (should fail)', async () => {
    await program.methods
      .setWhitelistInactive()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(50e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6001)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Payment amount not in accepted range'
      )
    }
  })

  it('Send to liquidity by user2 - payment amount not in range (should fail)', async () => {
    await program.methods
      .sendFromLiquidity(new anchor.BN(300e9), user2.publicKey)
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: admin.publicKey,
        receiverTokenAccount: itheum_token_user2_ata,
      })
      .signers([admin])
      .rpc()

    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(300e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: null,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: null,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6001)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Payment amount not in accepted range'
      )
    }
  })

  it('Send to liquidity by user2 - payment amount in range', async () => {
    await program.methods
      .sendToLiquidity(new anchor.BN(200e9), 'erd...', 'signature')
      .signers([user2])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        whitelist: null,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: user2.publicKey,
        authorityTokenAccount: itheum_token_user2_ata,
        feeCollector: null,
        mintOfFeeTokenSent: null,
        authorityFeeTokenAccount: null,
        feeCollectorAta: null,
      })
      .rpc()
  })

  it('Set whitelist inactive', async () => {
    await program.methods
      .setWhitelistInactive()
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.whitelistState == 0)
  })

  it('Set fee amount by admin', async () => {
    await program.methods
      .setFeeAmount(new anchor.BN(0.1e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.feeAmount.toNumber() === 0.1e9)
  })

  it('Set deposit limits by admin', async () => {
    await program.methods
      .setDepositLimits(new anchor.BN(10e9), new anchor.BN(1000e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeStateFetch = await program.account.bridgeState.fetch(
      bridgeStatePda
    )

    assert(bridgeStateFetch.minimumDeposit.toNumber() == 10e9)
    assert(bridgeStateFetch.maximumDeposit.toNumber() == 1000e9)
  })

  it('Send to liquidity by user2 - required fee - missing feeCollector (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: null,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: user2_wsol_ata,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2020)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A required account for the constraint is None'
      )
    }
  })

  it('Send to liquidity by user2 - required fee - missing mintOfFeeTokenSent (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(100e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: null,
          authorityFeeTokenAccount: user2_wsol_ata,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2020)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A required account for the constraint is None'
      )
    }
  })

  it('Send to liquidity by user2 - required fee - missing authorityFeeTokenAccount (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: null,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6008)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not all fee accounts were provided'
      )
    }
  })
  it('Set fee amount by admin', async () => {
    await program.methods
      .setFeeAmount(new anchor.BN(10e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.feeAmount.toNumber() === 10e9)
  })

  it('Send to liquidity by user2 - required fee - authorityFeeTokenAccount mismatch(balance) (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: user2_wsol_ata,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6005)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not enough balance'
      )
    }
  })

  it('Set fee by admin', async () => {
    await program.methods
      .setFeeAmount(new anchor.BN(0.1e9))
      .signers([admin])
      .accounts({
        bridgeState: bridgeStatePda,
        authority: admin.publicKey,
      })
      .rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridgeState.feeAmount.toNumber() === 0.1e9)
  })

  it('Send to liquidity by user2 - required fee - authorityFeeTokenAccount mismatch(Owner) (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: user_wsol_ata,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6006)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Owner mismatch'
      )
    }
  })

  it('Send to liquidity by user2 - required fee - authorityFeeTokenAccount mismatch(Mint) (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: another_token_user2_ata,
          feeCollectorAta: fee_collector_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6007)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Mint mismatch'
      )
    }
  })

  it('Send to liquidity by user2 - required fee - missing tempFeeCollector (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: user2_wsol_ata,
          feeCollectorAta: null,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6008)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Not all fee accounts were provided'
      )
    }
  })

  it('Send to liquidity by user2 - required fee - tempFeeCollector mismatch(Mint) (should fail)', async () => {
    try {
      await program.methods
        .sendToLiquidity(new anchor.BN(30e9), 'erd...', 'signature')
        .signers([user2])
        .accounts({
          bridgeState: bridgeStatePda,
          vault: vault_ata,
          whitelist: null,
          mintOfTokenSent: itheum_token_mint.publicKey,
          authority: user2.publicKey,
          authorityTokenAccount: itheum_token_user2_ata,
          feeCollector: fee_collector.publicKey,
          mintOfFeeTokenSent: NATIVE_MINT,
          authorityFeeTokenAccount: user2_wsol_ata,
          feeCollectorAta: vault_ata,
        })
        .rpc()
    } catch (err) {
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2014)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A token mint constraint was violated'
      )
    }
  })

  it('Send to liquidity by user2 - required fee ', async () => {
    await program.methods
      .sendToLiquidity(new anchor.BN(150e9), 'erd...', 'signature')
      .signers([user2])
      .accounts({
        bridgeState: bridgeStatePda,
        vault: vault_ata,
        whitelist: null,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority: user2.publicKey,
        authorityTokenAccount: itheum_token_user2_ata,
        feeCollector: fee_collector.publicKey,
        mintOfFeeTokenSent: NATIVE_MINT,
        authorityFeeTokenAccount: user2_wsol_ata,
        feeCollectorAta: fee_collector_ata,
      })
      .rpc()

    let fee_collector_account_balance = await connection.getTokenAccountBalance(
      fee_collector_ata
    )

    const expected_balance = 0.1e9 //  0.1e9 fee

    assert(
      Number(fee_collector_account_balance.value.amount) == expected_balance
    )

    let user2Ata = await getAccount(connection, itheum_token_user2_ata)

    assert(Number(user2Ata.amount) == 0e9)

    let bridge = await program.account.bridgeState.fetch(bridgeStatePda)

    assert(bridge.vaultAmount.toNumber() == 1200e9)
  })
})
