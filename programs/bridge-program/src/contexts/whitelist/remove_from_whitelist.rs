use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_PUBKEY,
    states::{BridgeState, WhitelistEntry},
};

#[derive(Accounts)]
#[instruction(entry: Pubkey)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
       mut,
       close=authority,
        seeds=[
            entry.key().as_ref(),
            bridge_state.key().as_ref()
        ],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    #[account(
        mut,
        address = ADMIN_PUBKEY,
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
    )]
    pub bridge_state: Account<'info, BridgeState>,
    system_program: Program<'info, System>,
}

impl<'info> RemoveFromWhitelist<'info> {
    pub fn remove_from_whitelist(&mut self, _address: Pubkey) -> Result<()> {
        Ok(())
    }
}
