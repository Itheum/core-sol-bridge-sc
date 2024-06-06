use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_PUBKEY,
    states::{bridge::State, BridgeState},
    Errors,
};

#[derive(Accounts)]
pub struct RelayerState<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    pub bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
    address=ADMIN_PUBKEY @ Errors::NotPrivileged,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
}

impl<'info> RelayerState<'info> {
    pub fn relayer_pause(&mut self) -> Result<()> {
        self.bridge_state.relayer_state = State::Inactive.to_code();
        Ok(())
    }

    pub fn relayer_unpause(&mut self) -> Result<()> {
        self.bridge_state.relayer_state = State::Active.to_code();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct PublicState<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    pub bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        constraint= authority.key() == ADMIN_PUBKEY || authority.key() == bridge_state.relayer_pubkey.key() @ Errors::NotPrivileged,
    )]
    pub authority: Signer<'info>,

    system_program: Program<'info, System>,
}

impl<'info> PublicState<'info> {
    pub fn public_pause(&mut self) -> Result<()> {
        self.bridge_state.public_state = State::Inactive.to_code();
        Ok(())
    }

    pub fn public_unpause(&mut self) -> Result<()> {
        self.bridge_state.public_state = State::Active.to_code();
        Ok(())
    }
}
