use anchor_lang::prelude::*;

use crate::{constants::ADMIN_PUBKEY, states::BridgeState};

#[derive(Accounts)]
pub struct UpdateFeeCollector<'info> {
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

impl<'info> UpdateFeeCollector<'info> {
    pub fn update_fee_collector(&mut self, fee_collector: Pubkey) -> Result<()> {
        self.bridge_state.fee_collector = fee_collector;
        Ok(())
    }
}
