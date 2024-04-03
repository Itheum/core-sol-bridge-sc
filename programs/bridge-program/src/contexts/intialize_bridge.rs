use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::states::{BridgeState, Stage, Whitelist};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct InitializeBridge<'info> {
    // Derived PDAs
    #[account(
        init,
        payer= user_sending,
        seeds=[b"bridge_state".as_ref(),user_sending.key().as_ref(),mint_of_token_sent.key().as_ref()],
        bump,
        space=BridgeState::INIT_SPACE,
    )]
    bridge_state: Account<'info, BridgeState>,

    #[account(
        seeds=[b"whitelist".as_ref()],
        bump=whitelist.bump,
    )]
    pub whitelist: Account<'info, Whitelist>,

    #[account(
        init_if_needed,
        payer= user_sending,
        associated_token::mint= mint_of_token_sent,
        associated_token::authority=bridge_state
    )]
    vault: Account<'info, TokenAccount>,

    #[account(mut)]
    user_sending: Signer<'info>,

    #[account(
        constraint=mint_of_token_sent.key()==whitelist.mint_of_token_whitelisted,
    )]
    mint_of_token_sent: Account<'info, Mint>,

    #[account(mut,
        constraint= user_sending_token_account.amount >= amount,
        constraint=user_sending_token_account.owner==user_sending.key(),
        constraint=user_sending_token_account.mint==mint_of_token_sent.key(),
    )]
    user_sending_token_account: Account<'info, TokenAccount>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitializeBridge<'info> {
    pub fn initialize_bridge(&mut self, bumps: &InitializeBridgeBumps, amount: u64) -> Result<()> {
        self.bridge_state.set_inner(BridgeState {
            bump: bumps.bridge_state,
            user_sending: self.user_sending.key(),
            mint_of_token_sent: self.mint_of_token_sent.key(),
            vault: self.vault.key(),
            amount,
            stage: Stage::BridgeInitialized.to_code(),
        });

        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        transfer_checked(
            self.into_deposit_context(),
            amount,
            self.mint_of_token_sent.decimals,
        )
    }

    fn into_deposit_context(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_accounts = TransferChecked {
            from: self.user_sending_token_account.to_account_info(),
            mint: self.mint_of_token_sent.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.user_sending.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
