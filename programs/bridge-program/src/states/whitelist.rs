use anchor_lang::prelude::*;

#[account]
pub struct Whitelist {
    pub bump: u8,
    pub mint_of_token_whitelisted: Pubkey,
    pub relayer_pk: Pubkey,
}

impl Space for Whitelist {
    const INIT_SPACE: usize = 8 + 8 + 32 + 32;
}
