use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, close_account, Burn, CloseAccount, Mint, Token, TokenAccount},
};

use crate::states::{BridgeState, Stage};

#[derive(Accounts)]
pub struct FinalizeBridge<'info> {
    #[account(
        mut,
        seeds=[b"bridge_state".as_ref(), user_sending.key().as_ref(), mint_of_token_sent.key().as_ref()],
        bump=bridge_state.bump,
        has_one= user_sending,
        has_one=mint_of_token_sent,
    )]
    bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        associated_token::mint=mint_of_token_sent,
        associated_token::authority=bridge_state
    )]
    vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    user_sending: Signer<'info>,
    #[account(mut)]
    mint_of_token_sent: Account<'info, Mint>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> FinalizeBridge<'info> {
    pub fn burn_and_close_vault(&mut self) -> Result<()> {
        let user_sending_pk = self.user_sending.key();
        let mint_of_token_sent_pk = self.mint_of_token_sent.key();
        let signer_seeds: [&[&[u8]]; 1] = [&[
            b"bridge_state",
            &user_sending_pk.as_ref(),
            &mint_of_token_sent_pk.as_ref(),
            &[self.bridge_state.bump],
        ]];

        msg!("seeds signer {:?}", signer_seeds);

        burn(
            self.into_burn_context().with_signer(&signer_seeds),
            self.bridge_state.amount,
        )?;

        self.bridge_state.stage = Stage::BridgeComplete.to_code();

        close_account(self.into_close_context().with_signer(&signer_seeds))
    }

    fn into_burn_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: self.mint_of_token_sent.to_account_info(),
            from: self.vault.to_account_info(),
            authority: self.bridge_state.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }

    fn into_close_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.user_sending.to_account_info(),
            authority: self.bridge_state.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
