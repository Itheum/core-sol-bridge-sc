use anchor_lang::prelude::*;

use crate::{constants::ADMIN_PUBKEY, states::BridgeState};

#[derive(Accounts)]
pub struct UpdateLimitsOrFee<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    pub bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        address = ADMIN_PUBKEY,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
}

impl<'info> UpdateLimitsOrFee<'info> {
    pub fn set_deposit_limits(&mut self, minimum_deposit: u64, maximum_deposit: u64) -> Result<()> {
        self.bridge_state.minimum_deposit = minimum_deposit;
        self.bridge_state.maximum_deposit = maximum_deposit;
        Ok(())
    }

    pub fn set_fee_amount(&mut self, fee_amount: u64) -> Result<()> {
        self.bridge_state.fee_amount = fee_amount;
        Ok(())
    }
}
