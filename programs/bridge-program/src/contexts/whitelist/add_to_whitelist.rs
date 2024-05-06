use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_PUBKEY,
    states::{BridgeState, WhitelistEntry},
};

#[derive(Accounts)]
#[instruction(entry: Pubkey)]
pub struct AddToWhitelist<'info> {
    #[account(
        init,
        space=WhitelistEntry::INIT_SPACE,
        payer=authority,
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

impl<'info> AddToWhitelist<'info> {
    pub fn add_to_whitelist(&mut self, address: Pubkey) -> Result<()> {
        self.whitelist_entry.set_inner(WhitelistEntry {
            whitelist_address: address,
            bridge_state_address: self.bridge_state.key(),
        });

        Ok(())
    }
}
