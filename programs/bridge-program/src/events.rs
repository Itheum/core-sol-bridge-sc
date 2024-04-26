use anchor_lang::prelude::*;

#[event]
pub struct InitailizeContractEvent {
    pub mint_of_token_whitelisted: Pubkey,
    pub relayer_pk: Pubkey,
    pub vault_pk: Pubkey,
    pub vault_amount: u64,
    pub state: u8,
}

#[event]
pub struct AddLiquidityEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RemoveLiquidityEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PauseEvent {
    pub from: Pubkey,
    pub state: u8,
}

#[event]
pub struct UnpauseEvent {
    pub from: Pubkey,
    pub state: u8,
}

#[event]
pub struct SendFromLiquidityEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub mint: Pubkey,
}

#[event]
pub struct SendToLiquidityEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub mint: Pubkey,
}
