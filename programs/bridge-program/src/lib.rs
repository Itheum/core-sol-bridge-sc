use anchor_lang::{prelude::*, solana_program};
use solana_program::pubkey::Pubkey;
mod contexts;
use contexts::*;
mod constants;
mod errors;
mod macros;
mod states;
use errors::*;
mod utils;
use utils::*;
declare_id!("83TuR9BMTzDd54iaen7cMhamm73Lj9cVpgrE44ks8Ezr");

#[program]
pub mod bridge_program {

    use crate::states::bridge::State;

    use super::*;

    pub fn initialize_bridge(
        ctx: Context<InitializeContract>,
        relayer_pk: Pubkey,
        minimum_deposit: u64,
        maximum_deposit: u64,
    ) -> Result<()> {
        ctx.accounts
            .initialize_contract(&ctx.bumps, relayer_pk, minimum_deposit, maximum_deposit)
    }

    pub fn update_relayer(ctx: Context<UpdateRelayer>, relayer_pk: Pubkey) -> Result<()> {
        ctx.accounts.update_relayer(relayer_pk)
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
        ctx: Context<DepositLimits>,
        minimum_deposit: u64,
        maximum_deposit: u64,
    ) -> Result<()> {
        ctx.accounts
            .set_deposit_limits(minimum_deposit, maximum_deposit)
    }

    pub fn pause(ctx: Context<ContractState>) -> Result<()> {
        ctx.accounts.pause()
    }

    pub fn unpause(ctx: Context<ContractState>) -> Result<()> {
        ctx.accounts.unpause()
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
        require_active!(ctx.accounts.bridge_state);
        ctx.accounts.send_from_liquidity(amount)
    }

    pub fn send_to_liquidity(
        ctx: Context<SendToLiquidity>,
        amount: u64,
        destination_address: String,
        destination_address_signature: String,
    ) -> Result<()> {
        require_active!(ctx.accounts.bridge_state);

        require!(
            check_amount(amount, ctx.accounts.mint_of_token_sent.decimals),
            Errors::NotWholeNumber
        );

        if ctx.accounts.bridge_state.whitelist_state == State::Active.to_code() {
            require!(ctx.accounts.whitelist.is_some(), Errors::NotWhitelisted);
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
