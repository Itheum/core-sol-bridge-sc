use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_PUBKEY,
    states::{bridge::State, BridgeState},
};

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    authority: Signer<'info>,

    system_program: Program<'info, System>,
}

impl<'info> Unpause<'info> {
    pub fn unpause(&mut self) -> Result<()> {
        self.bridge_state.state = State::Inactive.to_code();
        Ok(())
    }
}
