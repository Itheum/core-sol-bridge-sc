use anchor_lang::prelude::*;

#[account]
pub struct BridgeState {
    pub bump: u8,
    pub user_sending: Pubkey,
    pub mint_of_token_sent: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub stage: u8,
}

impl Space for BridgeState {
    const INIT_SPACE: usize = 8 + 8 + 8 + 32 + 32 + 32 + 8 + 1;
}
