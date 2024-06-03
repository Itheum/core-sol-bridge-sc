use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        close_account, transfer_checked, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
    },
};

use crate::{
    states::{BridgeState, WhitelistEntry},
    Errors,
};

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

    #[account(
        seeds=[authority.key().as_ref(), bridge_state.key().as_ref()],
        bump,
        constraint=whitelist.whitelist_address==authority.key()
    )]
    pub whitelist: Option<Account<'info, WhitelistEntry>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint=mint_of_token_sent.key()==bridge_state.mint_of_token_whitelisted,
    )]
    pub mint_of_token_sent: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint=authority_token_account.amount >= amount @ Errors::NotEnoughBalance,
        constraint=authority_token_account.owner==authority.key() @ Errors::OwnerMismatch,
        constraint=authority_token_account.mint==bridge_state.mint_of_token_whitelisted @ Errors::MintMismatch,
    )
    ]
    pub authority_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint=mint_of_fee_token_sent.key()==spl_token::native_mint::ID @ Errors::MintMismatch,
    )]
    pub mint_of_fee_token_sent: Option<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer=authority,
        associated_token::mint=mint_of_fee_token_sent,
        associated_token::authority=bridge_state,
    )]
    pub temp_fee_collector: Option<Account<'info, TokenAccount>>, // a temporary ATA that will hold the transaction wSOL fee

    #[account(
        mut,
        constraint=fee_collector.key()==bridge_state.fee_collector @ Errors::FeeCollectorMismatch,
    )]
    pub fee_collector: Option<SystemAccount<'info>>,

    pub program_data: Account<'info, ProgramData>,

    #[account(mut,
        constraint=authority_fee_token_account.amount >= bridge_state.fee_amount @ Errors::NotEnoughBalance,
        constraint=authority_fee_token_account.owner==authority.key() @ Errors::OwnerMismatch,
        constraint=authority_fee_token_account.mint==spl_token::native_mint::ID @ Errors::MintMismatch,
    )]
    pub authority_fee_token_account: Option<Account<'info, TokenAccount>>,

    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> SendToLiquidity<'info> {
    pub fn send_to_liquidity(&mut self, amount: u64) -> Result<()> {
        if self.bridge_state.fee_amount > 0 {
            let signer_seeds: [&[&[u8]]; 1] = [&[b"bridge_state", &[self.bridge_state.bump]]];

            transfer_checked(
                self.into_send_fee_context(),
                self.bridge_state.fee_amount,
                self.mint_of_fee_token_sent.as_ref().unwrap().decimals,
            )?;

            close_account(
                self.into_close_account_temp_fee_collector_context()
                    .with_signer(&signer_seeds),
            )?;
        }

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

    fn into_send_fee_context(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_accounts = TransferChecked {
            from: self
                .authority_fee_token_account
                .as_ref()
                .unwrap()
                .to_account_info(),
            to: self.temp_fee_collector.as_ref().unwrap().to_account_info(),
            mint: self
                .mint_of_fee_token_sent
                .as_ref()
                .unwrap()
                .to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }

    fn into_close_account_temp_fee_collector_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.temp_fee_collector.as_ref().unwrap().to_account_info(),
            destination: self.fee_collector.as_ref().unwrap().to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
