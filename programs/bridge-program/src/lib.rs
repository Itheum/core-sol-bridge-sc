use anchor_lang::{prelude::*, solana_program};
use solana_program::pubkey::Pubkey;
mod contexts;
use contexts::*;
mod states;

declare_id!("HmW1m2rdNRGxRGnCrLavoe7QuWUJb1R2Tgf1nVgji4Sm");

#[program]
pub mod bridge_program {

    use crate::contexts::AddTokenToWhitelist;

    use super::*;

    pub fn add_to_whitelist(
        ctx: Context<AddTokenToWhitelist>,
        mint_of_token_whitelisted: Pubkey,
        relayer_pk: Pubkey,
    ) -> Result<()> {
        ctx.accounts
            .add_to_whitelist(&ctx.bumps, mint_of_token_whitelisted, relayer_pk)
    }

    pub fn initialize_bridge(ctx: Context<InitializeBridge>, amount: u64) -> Result<()> {
        ctx.accounts.initialize_bridge(&ctx.bumps, amount)?;
        ctx.accounts.deposit(amount)
    }

    pub fn bridge_and_close(ctx: Context<FinalizeBridge>) -> Result<()> {
        ctx.accounts.burn_and_close_vault()
    }
}
