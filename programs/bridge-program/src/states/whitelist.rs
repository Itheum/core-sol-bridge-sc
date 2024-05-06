use anchor_lang::prelude::*;

#[account]
pub struct WhitelistEntry {
    pub whitelist_address: Pubkey,
    pub bridge_state_address: Pubkey,
}

impl Space for WhitelistEntry {
    const INIT_SPACE: usize = 8 + 32 + 32;
}
