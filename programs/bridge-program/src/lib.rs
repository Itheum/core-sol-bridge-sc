use anchor_lang::{prelude::*, solana_program};
use solana_program::pubkey::Pubkey;
mod contexts;
use contexts::*;
mod constants;
mod errors;
mod events;
mod macros;
mod states;
use events::*;

declare_id!("Fe5HCevToVhf1TsN9fwMrTgD8jcUM3bjFGfNXCmYjzD6");

#[program]
pub mod bridge_program {

    use crate::states::bridge::State;

    use super::*;

    pub fn initialize_bridge(ctx: Context<InitializeContract>, relayer_pk: Pubkey) -> Result<()> {
        emit!(InitailizeContractEvent {
            mint_of_token_whitelisted: ctx.accounts.mint_of_token_whitelisted.key(),
            relayer_pk,
            vault_pk: ctx.accounts.vault.key(),
            vault_amount: 0u64,
            state: State::Inactive.to_code(),
        });
        ctx.accounts.initialize_contract(&ctx.bumps, relayer_pk)
    }

    pub fn update_relayer(ctx: Context<UpdateRelayer>, relayer_pk: Pubkey) -> Result<()> {
        emit!(UpdateRelayerEvent {
            from: ctx.accounts.authority.key(),
            relayer_pk,
        });
        ctx.accounts.update_relayer(relayer_pk)
    }

    pub fn update_whitelisted_mint(
        ctx: Context<UpdateWhitelistedMint>,
        mint_of_token_whitelisted: Pubkey,
    ) -> Result<()> {
        emit!(UpdateWhitelistedMintEvent {
            from: ctx.accounts.authority.key(),
            mint_of_token_whitelisted,
        });
        ctx.accounts
            .update_whitelisted_mint(mint_of_token_whitelisted)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
        emit!(AddLiquidityEvent {
            from: ctx.accounts.authority_token_account.key(),
            to: ctx.accounts.vault.key(),
            amount,
        });
        ctx.accounts.add_liquidity(amount)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, amount: u64) -> Result<()> {
        emit!(RemoveLiquidityEvent {
            from: ctx.accounts.vault.key(),
            to: ctx.accounts.authority_token_account.key(),
            amount,
        });
        ctx.accounts.remove_liquidity(amount)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        emit!(PauseEvent {
            from: ctx.accounts.authority.key(),
            state: State::Inactive.to_code(),
        });
        ctx.accounts.pause()
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        emit!(UnpauseEvent {
            from: ctx.accounts.authority.key(),
            state: State::Active.to_code(),
        });
        ctx.accounts.unpause()
    }

    pub fn send_from_liquidity(
        ctx: Context<SendFromLiquidity>,
        amount: u64,
        _receiver: Pubkey,
    ) -> Result<()> {
        require_active!(ctx.accounts.bridge_state);
        emit!(SendFromLiquidityEvent {
            from: ctx.accounts.vault.key(),
            to: ctx.accounts.receiver_token_account.key(),
            mint: ctx.accounts.mint_of_token_sent.key(),
            amount,
        });
        ctx.accounts.send_from_liquidity(amount)
    }

    pub fn send_to_liquidity(ctx: Context<SendToLiquidity>, amount: u64) -> Result<()> {
        require_active!(ctx.accounts.bridge_state);
        emit!(SendToLiquidityEvent {
            from: ctx.accounts.authority_token_account.key(),
            to: ctx.accounts.vault.key(),
            mint: ctx.accounts.mint_of_token_sent.key(),
            amount,
        });
        ctx.accounts.send_to_liquidity(amount)
    }
}
