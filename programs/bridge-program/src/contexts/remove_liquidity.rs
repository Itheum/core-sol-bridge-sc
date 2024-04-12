use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{constants::ADMIN_PUBKEY, states::BridgeState};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds=["bridge_state".as_ref()],
        bump=bridge_state.bump,
        has_one=vault,
    )]
    bridge_state: Box<Account<'info, BridgeState>>,

    #[account(
        mut,
        constraint=vault.amount >= amount,
        associated_token::mint=mint_of_token_sent,
        associated_token::authority=bridge_state
    )]
    vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    authority: Signer<'info>,

    #[account(
        mut,
        constraint=mint_of_token_sent.key()==bridge_state.mint_of_token_whitelisted,
    )]
    mint_of_token_sent: Account<'info, Mint>,

    #[account(mut,
        constraint=authority_token_account.owner==authority.key(),
        constraint=authority_token_account.mint==mint_of_token_sent.key(),
    )]
    authority_token_account: Account<'info, TokenAccount>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> RemoveLiquidity<'info> {
    pub fn remove_liquidity(&mut self, amount: u64) -> Result<()> {
        let signer_seeds: [&[&[u8]]; 1] = [&[b"bridge_state", &[self.bridge_state.bump]]];

        self.bridge_state.vault_amount -= amount;
        transfer_checked(
            self.into_remove_liqudity_context()
                .with_signer(&signer_seeds),
            amount,
            self.mint_of_token_sent.decimals,
        )
    }

    fn into_remove_liqudity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint_of_token_sent.to_account_info(),
            to: self.authority_token_account.to_account_info(),
            authority: self.bridge_state.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
