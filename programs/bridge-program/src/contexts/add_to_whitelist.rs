use crate::states::Whitelist;
use anchor_lang::{
    prelude::*,
    solana_program::{self},
};
use solana_program::pubkey;

const ADMIN_PUBKEY: Pubkey = pubkey!("8rqbGpDceSrTLJ6DQoeRZCCLazKeH2g6uCSMzRTinYoP");

#[derive(Accounts)]
pub struct AddTokenToWhitelist<'info> {
    #[account(
        init_if_needed,
        payer=authority,
        space= Whitelist::INIT_SPACE,
        seeds=[b"whitelist".as_ref()],
        bump,
    )]
    pub whitelist: Account<'info, Whitelist>,

    #[account(
        mut,
        address=ADMIN_PUBKEY,
    )]
    authority: Signer<'info>,

    system_program: Program<'info, System>,
}

impl<'info> AddTokenToWhitelist<'info> {
    pub fn add_to_whitelist(
        &mut self,
        bumps: &AddTokenToWhitelistBumps,
        mint_of_token_whitelisted: Pubkey,
        relayer_pk: Pubkey,
    ) -> Result<()> {
        self.whitelist.set_inner(Whitelist {
            mint_of_token_whitelisted,
            bump: bumps.whitelist,
            relayer_pk,
        });

        Ok(())
    }
}
