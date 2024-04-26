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

  before('Airdrop and create mints', async () => {
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

    await provider.sendAndConfirm(tx, [admin])
  })


  it('Send to liquidity by user - bridge state not initialized (should fail)', async () => {
    try{
      await program.methods.sendToLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(3012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'The program expected this account to be already initialized'
      )
    }
  })


  it('Initialize contract by user (should fail)', async()=>{
    try{
      await program.methods.initializeBridge(user.publicKey).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenWhitelisted: itheum_token_mint.publicKey,
        authority:user.publicKey,    
      }).rpc()
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
    }).rpc()


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


  it('Add liquidity by user (should fail)', async()=>{
    try{
      await program.methods.addLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  });

  it('Add liquidity by admin - not whitelisted mint (should fail)', async()=>{
    try{
      await program.methods.addLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: another_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: another_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  });


  it('Add liquidity by admin - wrong(mint) admin ATA (should fail)', async()=>{
    try{
      await program.methods.addLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: another_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  });


  it('Add liquidity by admin - wrong(owner) admin ATA (should fail)', async()=>{
    try{
      await program.methods.addLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  });


  it('Add liquidity by admin - wrong amount (should fail)', async()=>{
    try{
      await program.methods.addLiquidity(new anchor.BN(3000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: itheum_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  });

  it('Add liquidity by admin', async()=>{
    await program.methods.addLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      authorityTokenAccount: itheum_token_admin_ata,
    }).rpc()


    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    
    assert(bridgeState.relayerPk.equals(admin.publicKey));
    assert(bridgeState.vault.equals(vault_ata));
    assert(bridgeState.vaultAmount.toNumber() === 1000e9);
    assert(bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)); 
    assert(bridgeState.state === 0);


    let vault = await getAccount(connection, vault_ata);
  
    assert(Number(vault.amount) == 1000e9);

  });

  it('Remove liquidity by user (should fail)', async()=>{
    try{
      await program.methods.removeLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    
    assert(bridgeState.relayerPk.equals(admin.publicKey));
    assert(bridgeState.vault.equals(vault_ata));
    assert(bridgeState.vaultAmount.toNumber() === 1000e9);
    assert(bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)); 
    assert(bridgeState.state === 0);


    let vault = await getAccount(connection, vault_ata);
  
    assert(Number(vault.amount) == 1000e9);
  });


  it('Remove liquidity by admin - wrong whitelisted mint (should fail)', async()=>{
    try{
      await program.methods.removeLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: another_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: another_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  it('Remove liquidity by admin - wrong(mint) admin ATA (should fail)', async()=>{
    try{
      await program.methods.removeLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: another_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })


  it('Remove liquidity by admin - wrong(owner) admin ATA (should fail)', async()=>{
    try{
      await program.methods.removeLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })


  it('Remove liquidity by admin - wrong amount (should fail)', async()=>{
    try{
      await program.methods.removeLiquidity(new anchor.BN(3000e9)).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        authorityTokenAccount: itheum_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })

  it('Remove liquidity by admin', async()=>{
    await program.methods.removeLiquidity(new anchor.BN(500e9)).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      authorityTokenAccount: itheum_token_admin_ata,
    }).rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    
    assert(bridgeState.relayerPk.equals(admin.publicKey));
    assert(bridgeState.vault.equals(vault_ata));
    assert(bridgeState.vaultAmount.toNumber() === 500e9);
    assert(bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)); 
    assert(bridgeState.state === 0);

    let vault = await getAccount(connection, vault_ata);

    assert(Number(vault.amount) == 500e9);

  })


  it('Remove liquidity by admin', async()=>{
    await program.methods.removeLiquidity(new anchor.BN(500e9)).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      authorityTokenAccount: itheum_token_admin_ata,
    }).rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    
    assert(bridgeState.relayerPk.equals(admin.publicKey));
    assert(bridgeState.vault.equals(vault_ata));
    assert(bridgeState.vaultAmount.toNumber() === 0);
    assert(bridgeState.mintOfTokenWhitelisted.equals(itheum_token_mint.publicKey)); 
    assert(bridgeState.state === 0);

    let adminAta = await getAccount(connection, itheum_token_admin_ata);

    assert(Number(adminAta.amount) == 1000e9);

    let vault = await getAccount(connection, vault_ata);

    assert(Number(vault.amount) == 0);
  })

  it('Pause contract by user (should fail)', async()=>{
    try{
      await program.methods.pause().signers([user]).accounts({
        bridgeState: bridgeStatePda,
        authority:user.publicKey,    
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  });

  it('Pause contract by admin', async()=>{
    await program.methods.pause().signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      authority:admin.publicKey,    
    }).rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    assert(bridgeState.state === 0);

  })


  it('Unpause contract by user (should fail)', async()=>{
    try{
      await program.methods.unpause().signers([user]).accounts({
        bridgeState: bridgeStatePda,
        authority:user.publicKey,    
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Unpause contract by admin', async()=>{
    await program.methods.unpause().signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      authority:admin.publicKey,    
    }).rpc()

    let bridgeState = await program.account.bridgeState.fetch(bridgeStatePda);

    assert(bridgeState.state === 1);

  })


  it('Send from liquidity by user (should fail)', async()=> {

    await program.methods.addLiquidity(new anchor.BN(1000e9)).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      authorityTokenAccount: itheum_token_admin_ata,
    }).rpc()

    try{
      await program.methods.sendFromLiquidity(new anchor.BN(1000e9), user.publicKey).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        receiverTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2012)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An address constraint was violated'
      )
    }
  })

  it('Send from liquidity by relayer - wrong amount (should fail)', async()=>{

    try{
      await program.methods.sendFromLiquidity(new anchor.BN(3000e9), user.publicKey).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        receiverTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })

  it('Send from liquidity by relayer - wrong whitelisted mint (should fail)', async()=>{

    try{
      await program.methods.sendFromLiquidity(new anchor.BN(1000e9), user.publicKey).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: another_token_mint.publicKey,
        authority:admin.publicKey,    
        receiverTokenAccount: itheum_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'An associated constraint was violated'
      )
    }
  })

  
  it('Send from liquidity by relayer - wrong(mint) user ATA (should fail)', async()=>{
    try{
      await program.methods.sendFromLiquidity(new anchor.BN(1000e9), user.publicKey).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        receiverTokenAccount: another_token_user_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })


  it('Send from liquidity by relayer - wrong(owner) user ATA (should fail)', async()=>{
    try{
      await program.methods.sendFromLiquidity(new anchor.BN(1000e9), user.publicKey).signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:admin.publicKey,    
        receiverTokenAccount: itheum_token_admin_ata,
      }).rpc()
      assert(false, 'Should have thrown error')
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })


  it('Send from liquidity by relayer - paused contract (should fail)', async()=>{

      await program.methods.pause().signers([admin]).accounts({
        bridgeState: bridgeStatePda,
        authority:admin.publicKey,    
      }).rpc()

  
      try{
    await program.methods.sendFromLiquidity(new anchor.BN(100e9), user.publicKey).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      receiverTokenAccount: itheum_token_user_ata,
    }).rpc()
  }catch(err){
    expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6000)
    expect((err as anchor.AnchorError).error.errorMessage).to.equal(
      'Program is paused'
    )
  }
   
  })

  it('Send from liquidity by relayer to user', async()=>{



    program.addEventListener("SendFromLiquidityEvent", (event) => {
      assert(event.from.toBase58() == vault_ata.toBase58());
      assert(event.to.toBase58() == itheum_token_user_ata.toBase58());
      assert(event.mint.toBase58() == itheum_token_mint.publicKey.toBase58());  
    });

    await program.methods.unpause().signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      authority:admin.publicKey,    
    }).rpc()

    await program.methods.sendFromLiquidity(new anchor.BN(100e9), user.publicKey).signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:admin.publicKey,    
      receiverTokenAccount: itheum_token_user_ata,
    }).rpc()

 

    let vault = await getAccount(connection, vault_ata);

    assert(Number(vault.amount) == 900e9);

    let userAta = await getAccount(connection, itheum_token_user_ata);

    assert(Number(userAta.amount) == 200e9); // 100e9 was already in user's account


    let bridge = await program.account.bridgeState.fetch(bridgeStatePda);

    assert(bridge.vaultAmount.toNumber() == 900e9);
  })


  it('Send to liquidity by user - paused contract (should fail)', async () =>{
    await program.methods.pause().signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      authority:admin.publicKey,    
    }).rpc()

    try{
      await program.methods.sendToLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(6000)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'Program is paused'
      )
    }
  })

  it('Sent to liquidity by user - wrong amount (should fail)', async () =>{
    await program.methods.unpause().signers([admin]).accounts({
      bridgeState: bridgeStatePda,
      authority:admin.publicKey,    
    }).rpc()

    try{
      await program.methods.sendToLiquidity(new anchor.BN(1000e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_user_ata,
      }).rpc()
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })

  it('Send to liquidity by user - wrong whitelisted mint (should fail)', async () =>{

      try{
        await program.methods.sendToLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
          bridgeState: bridgeStatePda,
          vault:vault_ata,
          mintOfTokenSent: another_token_mint.publicKey,
          authority:user.publicKey,    
          authorityTokenAccount: itheum_token_user_ata,
        }).rpc()
      }catch(err){
        expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2009)
        expect((err as anchor.AnchorError).error.errorMessage).to.equal(
          'An associated constraint was violated'
        )
      }
})

  it('Send to liquidity by user - wrong(mint) user ATA (should fail)', async () =>{

    try{
      await program.methods.sendToLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: another_token_user_ata,
      }).rpc()
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }

  })


  it('Send to liquidity by user - wrong(owner) user ATA (should fail)', async () =>{

    try{
      await program.methods.sendToLiquidity(new anchor.BN(100e9)).signers([user]).accounts({
        bridgeState: bridgeStatePda,
        vault:vault_ata,
        mintOfTokenSent: itheum_token_mint.publicKey,
        authority:user.publicKey,    
        authorityTokenAccount: itheum_token_admin_ata,
      }).rpc()
    }catch(err){
      expect((err as anchor.AnchorError).error.errorCode.number).to.equal(2003)
      expect((err as anchor.AnchorError).error.errorMessage).to.equal(
        'A raw constraint was violated'
      )
    }
  })


  it('Send to liquidity by user', async () =>{
    await program.methods.sendToLiquidity(new anchor.BN(200e9)).signers([user]).accounts({
      bridgeState: bridgeStatePda,
      vault:vault_ata,
      mintOfTokenSent: itheum_token_mint.publicKey,
      authority:user.publicKey,    
      authorityTokenAccount: itheum_token_user_ata,
    }).rpc()

    let vault = await getAccount(connection, vault_ata);

    assert(Number(vault.amount) == 1100e9);

    let userAta = await getAccount(connection, itheum_token_user_ata);

    assert(Number(userAta.amount) == 0e9);

    let bridge = await program.account.bridgeState.fetch(bridgeStatePda);

    assert(bridge.vaultAmount.toNumber() == 1100e9);
  })

})
