import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {BridgeProgram} from '../target/types/bridge_program'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getOrCreateAssociatedTokenAccount,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {keypairIdentity, token, Metaplex} from '@metaplex-foundation/js'
import {Keypair, Connection} from '@solana/web3.js'
import {TokenStandard} from '@metaplex-foundation/mpl-token-metadata'
import {ASSOCIATED_PROGRAM_ID} from '@coral-xyz/anchor/dist/cjs/utils/token'
import {assert, expect} from 'chai'

require('dotenv').config()

describe('bridge-program', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const provider = anchor.getProvider()
  const program = anchor.workspace.BridgeProgram as Program<BridgeProgram>

  const connection = provider.connection

  const PRIVATE_KEY_STR = process.env.PRIVATE_KEY
  const privateKeys = PRIVATE_KEY_STR.split(',').map(Number)

  const [user, itheum_token_mint, another_token_mint] = Array.from({length: 3}, () => Keypair.generate())

  const itheum_token_user_ata = getAssociatedTokenAddressSync(itheum_token_mint.publicKey, user.publicKey)
  const another_token_user_ata = getAssociatedTokenAddressSync(another_token_mint.publicKey, user.publicKey)



  const admin = Keypair.fromSecretKey(Uint8Array.from(privateKeys))


  const itheum_token_admin_ata= getAssociatedTokenAddressSync(itheum_token_mint.publicKey, admin.publicKey)
  const another_token_admin_ata = getAssociatedTokenAddressSync(another_token_mint.publicKey, admin.publicKey)



  const bridgeStatePda = PublicKey.findProgramAddressSync(
    [
      Buffer.from('bridge_state'),
    ],
    program.programId
  )[0]

  const vault_ata = getAssociatedTokenAddressSync(
    itheum_token_mint.publicKey,
    bridgeStatePda,
    true
  )

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

  it('Airdrop and create mints', async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(connection)

    let tx2 = new Transaction()
    tx2.instructions = [
      ...[admin].map((k) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[itheum_token_mint,another_token_mint].map((m) =>
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: m.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      ),
      ...[[itheum_token_mint.publicKey, admin.publicKey, itheum_token_admin_ata],
          [another_token_mint.publicKey,admin.publicKey, another_token_admin_ata],
    ].flatMap((x) => [
      createInitializeMint2Instruction(x[0], 9, x[1], x[1]),
      createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, x[2], x[1], x[0],TOKEN_PROGRAM_ID),
      createMintToInstruction(x[0], x[2], x[1], 1000e9),
    ])
    ]
    await provider.sendAndConfirm(tx2, [admin,itheum_token_mint,another_token_mint]).then(log)


    let tx = new Transaction()
    tx.instructions = [
      ...[user].map((k) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: k.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[[itheum_token_mint.publicKey, user.publicKey, itheum_token_user_ata],
          [another_token_mint.publicKey,user.publicKey, another_token_user_ata],
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

    await provider.sendAndConfirm(tx, [admin]).then(log)
  })


  it('Initialize contract by user (should fail)', async()=>{
    try{
      await program.methods.initializeBridge(user.publicKey).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenWhitelisted: itheum_token_mint.publicKey,
        authority:user.publicKey,    
      }).rpc().then(confirm).then(log)
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  });


    it('Initialize contract by admin', async()=>{
    await program.methods.initializeBridge(admin.publicKey).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenWhitelisted: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
    }).rpc().then(confirm).then(log)


  let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    assert(bridgeState.state === 0);
    assert(bridgeState.relayerPk.equals(admin.publicKey));
    assert(bridgeState.vault.equals(vault_ata));
    assert(bridgeState.vaultAmount.toNumber() === 0);
    assert(bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)); 
    assert(bridgeState.state === 0);


    let vault = await getAccount(connection, vault_ata);
  
    assert(vault.mint.equals(itheum_token_mint.publicKey));
    assert(vault.owner.equals(bridgeStatePda));
  })
})