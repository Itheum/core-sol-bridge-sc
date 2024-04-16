use anchor_lang::{prelude::*, solana_program};
use solana_program::pubkey::Pubkey;
mod contexts;
use contexts::*;
mod constants;
mod errors;
mod macros;
mod states;

declare_id!("HmW1m2rdNRGxRGnCrLavoe7QuWUJb1R2Tgf1nVgji4Sm");

#[program]
pub mod bridge_program {

    use super::*;

    pub fn initialize_bridge(ctx: Context<InitializeContract>, relayer_pk: Pubkey) -> Result<()> {
        ctx.accounts.initialize_contract(&ctx.bumps, relayer_pk)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
        ctx.accounts.add_liquidity(amount)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, amount: u64) -> Result<()> {
        ctx.accounts.remove_liquidity(amount)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.pause()
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        ctx.accounts.unpause()
    }

    // [TO DO] relayer endpoint to send tokens from vault to user who bridged tokens

    // [TO DO] user endpoint to send tokens to vault to bridge tokens back
}
