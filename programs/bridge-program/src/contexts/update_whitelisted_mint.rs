use anchor_lang::prelude::*;

use crate::{constants::ADMIN_PUBKEY, states::BridgeState};

#[derive(Accounts)]
pub struct UpdateWhitelistedMint<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    pub bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
}
impl<'info> UpdateWhitelistedMint<'info> {
    pub fn update_whitelisted_mint(&mut self, mint_of_token_whitelisted: Pubkey) -> Result<()> {
        self.bridge_state.mint_of_token_whitelisted = mint_of_token_whitelisted;
        Ok(())
    }
}
