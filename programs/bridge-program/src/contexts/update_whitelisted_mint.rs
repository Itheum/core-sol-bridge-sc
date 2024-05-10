use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

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
        init_if_needed,
        payer=authority,
        associated_token::mint=mint_of_token_whitelisted,
        associated_token::authority=bridge_state,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub mint_of_token_whitelisted: Box<Account<'info, Mint>>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}
impl<'info> UpdateWhitelistedMint<'info> {
    pub fn update_whitelisted_mint(&mut self) -> Result<()> {
        self.bridge_state.mint_of_token_whitelisted = self.mint_of_token_whitelisted.key();
        self.bridge_state.vault_amount = self.vault.amount; // update state with vault balance
        Ok(())
    }
}
