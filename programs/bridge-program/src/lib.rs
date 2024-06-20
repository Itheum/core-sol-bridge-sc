use anchor_lang::{prelude::*, solana_program};
use solana_program::pubkey::Pubkey;
mod contexts;
use contexts::*;
mod constants;
mod errors;
mod states;
use errors::*;
mod utils;
use utils::*;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "itheum-bridge-program",
    project_url: "https://www.itheum.io/",
    contacts: "https://itheum.io/bug-bounty",
    policy: "https://itheum.io/bug-bounty",
    source_code: "https://github.com/Itheum/core-sol-bridge-sc",
    preferred_languages: "en",
    auditors: "https://itheum.io/audits"
}

declare_id!("bitH2bkiBmbcio1riko9qLhkgKdAtY4BEx61ZQuvrfj");

#[program]
pub mod bridge_program {

    use crate::states::bridge::State;

    use super::*;

    pub fn initialize_contract(
        ctx: Context<InitializeContract>,
        relayer_pubkey: Pubkey,
        fee_collector: Pubkey,
        fee_amount: u64,
        minimum_deposit: u64,
        maximum_deposit: u64,
    ) -> Result<()> {
        ctx.accounts.initialize_contract(
            &ctx.bumps,
            relayer_pubkey,
            fee_collector,
            fee_amount,
            minimum_deposit,
            maximum_deposit,
        )
    }

    pub fn update_fee_collector(
        ctx: Context<UpdateFeeCollector>,
        fee_collector: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_fee_collector(fee_collector)
    }

    pub fn update_relayer(ctx: Context<UpdateRelayer>, relayer_pubkey: Pubkey) -> Result<()> {
        ctx.accounts.update_relayer(relayer_pubkey)
    }

    pub fn update_whitelisted_mint(ctx: Context<UpdateWhitelistedMint>) -> Result<()> {
        ctx.accounts.update_whitelisted_mint()
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
        ctx.accounts.add_liquidity(amount)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, amount: u64) -> Result<()> {
        ctx.accounts.remove_liquidity(amount)
    }

    pub fn set_deposit_limits(
        ctx: Context<UpdateLimitsOrFee>,
        minimum_deposit: u64,
        maximum_deposit: u64,
    ) -> Result<()> {
        ctx.accounts
            .set_deposit_limits(minimum_deposit, maximum_deposit)
    }

    pub fn set_fee_amount(ctx: Context<UpdateLimitsOrFee>, fee_amount: u64) -> Result<()> {
        ctx.accounts.set_fee_amount(fee_amount)
    }

    pub fn relayer_pause(ctx: Context<RelayerState>) -> Result<()> {
        ctx.accounts.relayer_pause()
    }

    pub fn relayer_unpause(ctx: Context<RelayerState>) -> Result<()> {
        ctx.accounts.relayer_unpause()
    }

    pub fn public_pause(ctx: Context<PublicState>) -> Result<()> {
        ctx.accounts.public_pause()
    }

    pub fn public_unpause(ctx: Context<PublicState>) -> Result<()> {
        ctx.accounts.public_unpause()
    }

    pub fn set_whitelist_active(ctx: Context<WhitelistState>) -> Result<()> {
        ctx.accounts.set_whitelist_active()
    }

    pub fn set_whitelist_inactive(ctx: Context<WhitelistState>) -> Result<()> {
        ctx.accounts.set_whitelist_inactive()
    }

    pub fn add_to_whitelist(ctx: Context<AddToWhitelist>, address: Pubkey) -> Result<()> {
        ctx.accounts.add_to_whitelist(address)
    }

    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>, address: Pubkey) -> Result<()> {
        ctx.accounts.remove_from_whitelist(address)
    }

    pub fn send_from_liquidity(
        ctx: Context<SendFromLiquidity>,
        amount: u64,
        _receiver: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.bridge_state.relayer_state == State::Active.to_code(),
            Errors::ProgramIsPaused
        );

        ctx.accounts.send_from_liquidity(amount)
    }

    pub fn send_to_liquidity(
        ctx: Context<SendToLiquidity>,
        amount: u64,
        destination_address: String,
        destination_address_signature: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.bridge_state.public_state == State::Active.to_code(),
            Errors::ProgramIsPaused
        );

        require!(
            check_amount(amount, ctx.accounts.mint_of_token_sent.decimals),
            Errors::NotWholeNumber
        );

        if ctx.accounts.bridge_state.whitelist_state == State::Active.to_code() {
            require!(ctx.accounts.whitelist.is_some(), Errors::NotWhitelisted);
        }

        if ctx.accounts.bridge_state.fee_amount > 0 {
            require!(
                ctx.accounts.authority_fee_token_account.is_some()
                    && ctx.accounts.fee_collector_ata.is_some()
                    && ctx.accounts.fee_collector.is_some()
                    && ctx.accounts.mint_of_fee_token_sent.is_some(),
                Errors::NoFeeAccountsProvided
            );
        }

        require!(
            ctx.accounts.bridge_state.minimum_deposit <= amount
                && amount <= ctx.accounts.bridge_state.maximum_deposit,
            Errors::PaymentAmountNotInAcceptedRange
        );

        msg!("amount_sent: {}", amount);
        msg!("destination_address: {}", destination_address);
        msg!(
            "destination_address_signature: {}",
            destination_address_signature
        );

        ctx.accounts.send_to_liquidity(amount)
    }
}
