use crate::utils::get_function_hash;
use anchor_client::{anchor_lang::AnchorSerialize, solana_sdk::signature::Signer};

use solana_client::rpc_config::RpcSendTransactionConfig;

use {
    solana_client::nonblocking::rpc_client::RpcClient,
    solana_sdk::{
        instruction::Instruction, message::Message, signature::Signature, transaction::Transaction,
    },
};

use solana_sdk::instruction::AccountMeta;

use anchor_client::anchor_lang::system_program;
use solana_program::pubkey::Pubkey;
use spl_associated_token_account::get_associated_token_address;

use bridge_program::instruction as bridge_program_instructions;

pub async fn process_initialize_contract(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    relayer_pubkey: Pubkey,
    fee_collector: Pubkey,
    mint_of_token_whitelisted: Pubkey,
    minimum_deposit: u64,
    maximum_deposit: u64,
    fee_amount: u64,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let vault_ata = get_associated_token_address(&bridge_pda, &mint_of_token_whitelisted);

    let method = get_function_hash("global", "initialize_contract");

    let init_another = bridge_program_instructions::InitializeContract {
        fee_collector,
        fee_amount,
        relayer_pubkey,
        minimum_deposit,
        maximum_deposit,
    };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut init_another.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new(vault_ata, false),
            AccountMeta::new_readonly(mint_of_token_whitelisted, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
            AccountMeta::new_readonly(spl_associated_token_account::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_update_relayer(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    relayer_pubkey: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "update_relayer");

    let update_relayer = bridge_program_instructions::UpdateRelayer { relayer_pubkey };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut update_relayer.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_update_whitelisted_mint(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    mint_of_token_whitelisted: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);
    let vault_ata = get_associated_token_address(&bridge_pda, &mint_of_token_whitelisted);

    let method = get_function_hash("global", "update_whitelisted_mint");

    let update_whitelisted_mint = bridge_program_instructions::UpdateWhitelistedMint {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut update_whitelisted_mint.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new(vault_ata, false),
            AccountMeta::new_readonly(mint_of_token_whitelisted, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
            AccountMeta::new_readonly(spl_associated_token_account::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_add_liquidity(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    amount: u64,
    mint_of_token_sent: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let vault_ata = get_associated_token_address(&bridge_pda, &mint_of_token_sent);

    let signer_ata = get_associated_token_address(&signer.pubkey(), &mint_of_token_sent);

    let method = get_function_hash("global", "add_liquidity");

    let add_liquidity = bridge_program_instructions::AddLiquidity { amount };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut add_liquidity.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new(vault_ata, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(mint_of_token_sent, false),
            AccountMeta::new(signer_ata, false),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
            AccountMeta::new_readonly(spl_associated_token_account::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_remove_liquidity(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    amount: u64,
    mint_of_token_sent: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let vault_ata = get_associated_token_address(&bridge_pda, &mint_of_token_sent);

    let signer_ata = get_associated_token_address(&signer.pubkey(), &mint_of_token_sent);

    let method = get_function_hash("global", "remove_liquidity");

    let remove_liquidity = bridge_program_instructions::RemoveLiquidity { amount };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut remove_liquidity.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new(vault_ata, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(mint_of_token_sent, false),
            AccountMeta::new(signer_ata, false),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
            AccountMeta::new_readonly(spl_associated_token_account::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_set_deposit_limits(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    minimum_deposit: u64,
    maximum_deposit: u64,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "set_deposit_limits");

    let set_deposit_limits = bridge_program_instructions::SetDepositLimits {
        minimum_deposit,
        maximum_deposit,
    };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut set_deposit_limits.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_set_fee_amount(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    fee_amount: u64,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "set_fee_amount");

    let set_fee_amount = bridge_program_instructions::SetFeeAmount { fee_amount };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut set_fee_amount.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_public_pause_contract(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "public_pause");

    let pause_contract = bridge_program_instructions::PublicPause {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut pause_contract.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_relayer_pause(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "relayer_pause");

    let pause_contract = bridge_program_instructions::RelayerPause {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut pause_contract.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_relayer_unpause(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "relayer_unpause");

    let unpause_contract = bridge_program_instructions::RelayerUnpause {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut unpause_contract.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_public_unpause_contract(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "public_unpause");

    let unpause_contract = bridge_program_instructions::PublicUnpause {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut unpause_contract.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_set_whitelist_active(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "set_whitelist_active");

    let set_whitelist_active = bridge_program_instructions::SetWhitelistActive {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut set_whitelist_active.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_set_whitelist_inactive(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let method = get_function_hash("global", "set_whitelist_inactive");

    let set_whitelist_inactive = bridge_program_instructions::SetWhitelistInactive {};

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut set_whitelist_inactive.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_add_to_whitelist(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    entry_pk: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let (whitelist_entry_pda, _) =
        Pubkey::find_program_address(&[entry_pk.as_ref(), bridge_pda.as_ref()], &program_id);

    let method = get_function_hash("global", "add_to_whitelist");

    let add_to_whitelist = bridge_program_instructions::AddToWhitelist { address: entry_pk };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut add_to_whitelist.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(whitelist_entry_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}

pub async fn process_remove_from_whitelist(
    rpc_client: &RpcClient,
    signer: &dyn Signer,
    program_id: Pubkey,
    entry_pk: Pubkey,
) -> Result<Signature, Box<dyn std::error::Error>> {
    let (bridge_pda, _) = Pubkey::find_program_address(&[b"bridge_state"], &program_id);

    let (entry_pda, _) =
        Pubkey::find_program_address(&[entry_pk.as_ref(), bridge_pda.as_ref()], &program_id);

    let method = get_function_hash("global", "remove_from_whitelist");

    let remove_from_whitelist =
        bridge_program_instructions::RemoveFromWhitelist { address: entry_pk };

    let mut method_bytes = method.to_vec();

    method_bytes.append(&mut remove_from_whitelist.try_to_vec()?);

    let ix = Instruction::new_with_bytes(
        program_id,
        &method_bytes,
        vec![
            AccountMeta::new(entry_pda, false),
            AccountMeta::new_readonly(signer.pubkey(), true),
            AccountMeta::new(bridge_pda, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
    );

    let mut tx = Transaction::new_unsigned(Message::new(&[ix], Some(&signer.pubkey())));

    let blockhash = rpc_client
        .get_latest_blockhash()
        .await
        .map_err(|err| format!("error: unable to get latest blockhash: {err}"))?;

    tx.try_sign(&vec![signer], blockhash)
        .map_err(|err| format!("error: failed to sign transaction: {err}"))?;

    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send_transaction_with_config(&tx, config)
        .await
        .map_err(|err| format!("error: send transaction: {err}"))?;

    Ok(signature)
}
