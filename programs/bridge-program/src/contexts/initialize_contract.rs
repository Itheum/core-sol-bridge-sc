use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::ADMIN_PUBKEY,
    states::{bridge::State, BridgeState},
};

#[derive(Accounts)]
pub struct InitializeContract<'info> {
    #[account(
        init,
        payer=authority,
        seeds=["bridge_state".as_ref()],
        bump,
        space=BridgeState::INIT_SPACE,
    )]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(
        init_if_needed,
        payer=authority,
        associated_token::mint=mint_of_token_whitelisted,
        associated_token::authority=bridge_state,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub mint_of_token_whitelisted: Account<'info, Mint>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitializeContract<'info> {
    pub fn initialize_contract(
        &mut self,
        bumps: &InitializeContractBumps,
        relayer_pk: Pubkey,
    ) -> Result<()> {
        self.bridge_state.set_inner(BridgeState {
            bump: bumps.bridge_state,
            mint_of_token_whitelisted: self.mint_of_token_whitelisted.key(),
            relayer_pk,
            vault: self.vault.key(),
            vault_amount: 0u64,
            state: State::Inactive.to_code(),
        });

        Ok(())
    }
}
