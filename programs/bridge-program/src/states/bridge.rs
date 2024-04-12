use anchor_lang::prelude::*;

#[account]
pub struct BridgeState {
    pub bump: u8,
    pub mint_of_token_whitelisted: Pubkey,
    pub relayer_pk: Pubkey,
    pub vault: Pubkey,
    pub vault_amount: u64,
}

impl Space for BridgeState {
    const INIT_SPACE: usize = 8 + 1 + 32 + 32 + 32 + 8;
}
