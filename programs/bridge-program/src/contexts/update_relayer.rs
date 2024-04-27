use anchor_lang::prelude::*;

use crate::{constants::ADMIN_PUBKEY, states::BridgeState};

#[derive(Accounts)]
pub struct UpdateRelayer<'info> {
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

impl<'info> UpdateRelayer<'info> {
    pub fn update_relayer(&mut self, relayer_pk: Pubkey) -> Result<()> {
        self.bridge_state.relayer_pk = relayer_pk;
        Ok(())
    }
}
