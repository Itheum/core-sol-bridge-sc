use anchor_lang::prelude::*;

#[account]
pub struct BridgeState {
    pub bump: u8,
    pub mint_of_token_whitelisted: Pubkey,
    pub relayer_pk: Pubkey,
    pub vault: Pubkey,
    pub vault_amount: u64,
    pub state: u8,
    pub minimum_deposit: u64,
    pub maximum_deposit: u64,
}

impl Space for BridgeState {
    const INIT_SPACE: usize = 8 + 1 + 32 + 32 + 32 + 8 + 1 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum State {
    Inactive = 0,
    Active = 1,
}
impl State {
    pub fn to_code(&self) -> u8 {
        match self {
            State::Inactive => 0,
            State::Active => 1,
        }
    }
}
