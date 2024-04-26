use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::states::BridgeState;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct SendToLiquidity<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
        has_one=vault,
    )]
    pub bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        associated_token::mint=mint_of_token_sent,
        associated_token::authority=bridge_state
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint=mint_of_token_sent.key()==bridge_state.mint_of_token_whitelisted,
    )]
    pub mint_of_token_sent: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint=authority_token_account.amount >= amount,
        constraint=authority_token_account.owner==authority.key(),
        constraint=authority_token_account.mint==bridge_state.mint_of_token_whitelisted
    )
    ]
    pub authority_token_account: Account<'info, TokenAccount>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> SendToLiquidity<'info> {
    pub fn send_to_liquidity(&mut self, amount: u64) -> Result<()> {
        self.bridge_state.vault_amount += amount;

        transfer_checked(
            self.into_send_to_liquidity_context(),
            amount,
            self.mint_of_token_sent.decimals,
        )
    }

    fn into_send_to_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_accounts = TransferChecked {
            from: self.authority_token_account.to_account_info(),
            to: self.vault.to_account_info(),
            mint: self.mint_of_token_sent.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
