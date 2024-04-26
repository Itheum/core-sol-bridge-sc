use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_PUBKEY,
    states::{bridge::State, BridgeState},
};

#[derive(Accounts)]
pub struct Pause<'info> {
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

impl<'info> Pause<'info> {
    pub fn pause(&mut self) -> Result<()> {
        self.bridge_state.state = State::Inactive.to_code();
        Ok(())
    }
}
