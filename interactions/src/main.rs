use crate::admin_endpoints::{
    process_add_liquidity, process_add_to_whitelist, process_initialize_contract,
    process_public_pause_contract, process_public_unpause_contract, process_relayer_pause,
    process_relayer_unpause, process_remove_from_whitelist, process_remove_liquidity,
    process_set_deposit_limits, process_set_whitelist_active, process_set_whitelist_inactive,
    process_update_relayer, process_update_whitelisted_mint,
};
use anchor_client::solana_sdk::signature::Signer;

use {
    clap::{crate_description, crate_name, crate_version, Arg, Command},
    solana_clap_v3_utils::{
        input_parsers::{parse_url_or_moniker, pubkey_of},
        input_validators::{is_valid_signer, normalize_to_url_if_moniker},
        keypair::DefaultSigner,
    },
    solana_client::nonblocking::rpc_client::RpcClient,
    solana_remote_wallet::remote_wallet::RemoteWalletManager,
    solana_sdk::commitment_config::CommitmentConfig,
    std::{process::exit, rc::Rc},
};

mod admin_endpoints;
mod utils;

struct Config {
    commitment_config: CommitmentConfig,
    default_signer: Box<dyn Signer>,
    json_rpc_url: String,
    verbose: bool,
    websocket_url: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app_matches = Command::new(crate_name!())
        .about(crate_description!())
        .version(crate_version!())
        .subcommand_required(true)
        .arg_required_else_help(true)
        .arg({
            let arg = Arg::new("config_file")
                .short('C')
                .long("config")
                .value_name("PATH")
                .takes_value(true)
                .global(true)
                .help("Configuration file to use");
            if let Some(ref config_file) = *solana_cli_config::CONFIG_FILE {
                arg.default_value(config_file)
            } else {
                arg
            }
        })
        .arg(
            Arg::new("keypair")
                .long("keypair")
                .value_name("KEYPAIR")
                .validator(|s| is_valid_signer(s))
                .takes_value(true)
                .global(true)
                .help("Filepath or URL to a keypair [default: client keypair]"),
        )
        .arg(
            Arg::new("verbose")
                .long("verbose")
                .short('v')
                .takes_value(false)
                .global(true)
                .help("Show additional information"),
        )
        .arg(
            Arg::new("json_rpc_url")
                .short('u')
                .long("url")
                .value_name("URL")
                .takes_value(true)
                .global(true)
                .value_parser(parse_url_or_moniker)
                .help("JSON RPC URL for the cluster [default: value from configuration file]"),
        )
        .subcommand(
            Command::new("initializeContract")
                .about("Send an initialize contract transaction")
                .arg(
                    Arg::new("relayer_pk")
                        .required(true)
                        .value_name("RELAYER_PK")
                        .takes_value(true)
                        .help("Relayer public key"),
                )
                .arg(
                    Arg::new("fee_collector_pk")
                        .required(true)
                        .value_name("FEE_COLLECTOR_PK")
                        .takes_value(true)
                        .help("Fee collector public key"),
                )
                .arg(
                    Arg::new("fee_amount")
                        .required(true)
                        .value_name("FEE_AMOUNT")
                        .takes_value(true)
                        .help("Fee amount"),
                )
                .arg(
                    Arg::new("minimum_deposit")
                        .required(true)
                        .value_name("MINIMUM_DEPOSIT")
                        .takes_value(true)
                        .help("Minimum deposit"),
                )
                .arg(
                    Arg::new("maximum_deposit")
                        .required(true)
                        .value_name("MAXIMUM_DEPOSIT")
                        .takes_value(true)
                        .help("Maximum deposit"),
                )
                .arg(
                    Arg::new("mint_of_token_whitelisted")
                        .required(true)
                        .value_name("MINT_OF_TOKEN_WHITELISTED")
                        .takes_value(true)
                        .help("Mint of token whitelisted"),
                ),
        )
        .subcommand(
            Command::new("updateRelayer")
                .about("Send an update relayer transaction")
                .arg(
                    Arg::new("relayer_pk")
                        .required(true)
                        .value_name("RELAYER_PK")
                        .takes_value(true)
                        .help("New relayer public key"),
                ),
        )
        .subcommand(
            Command::new("updateWhitelistedMint")
                .about("Send a update whitelisted mint transaction")
                .arg(
                    Arg::new("mint_of_token_whitelisted")
                        .required(true)
                        .value_name("MINT_OF_TOKEN_WHITELISTED")
                        .takes_value(true)
                        .help("Mint of token whitelisted"),
                ),
        )
        .subcommand(
            Command::new("addLiquidity")
                .about("Send an add liquidity transaction")
                .arg(
                    Arg::new("amount")
                        .required(true)
                        .value_name("AMOUNT")
                        .takes_value(true)
                        .help("Amount to add"),
                )
                .arg(
                    Arg::new("mint_of_token_sent")
                        .required(true)
                        .value_name("MINT_OF_TOKEN_SENT")
                        .help("Mint of token sent"),
                ),
        )
        .subcommand(
            Command::new("removeLiquidity")
                .about("Send a remove liquidity transaction")
                .arg(
                    Arg::new("amount")
                        .required(true)
                        .value_name("AMOUNT")
                        .takes_value(true)
                        .help("Amount to remove"),
                )
                .arg(
                    Arg::new("mint_of_token_sent")
                        .required(true)
                        .value_name("MINT_OF_TOKEN_sent")
                        .help("Mint of token sent by the program"),
                ),
        )
        .subcommand(
            Command::new("setDepositLimits")
                .about("Send a set deposit limits transaction")
                .arg(
                    Arg::new("minimum_deposit")
                        .required(true)
                        .value_name("MINIMUM_DEPOSIT")
                        .takes_value(true)
                        .help("Minimum deposit"),
                )
                .arg(
                    Arg::new("maximum_deposit")
                        .required(true)
                        .value_name("MAXIMUM_DEPOSIT")
                        .takes_value(true)
                        .help("Maximum deposit"),
                ),
        )
        .subcommand(Command::new("publicPause").about("Send a pause transaction"))
        .subcommand(Command::new("publicUnpause").about("Send a unpause transaction"))
        .subcommand(Command::new("relayerPause").about("Send a relayer pause transaction"))
        .subcommand(Command::new("relayerUnpause").about("Send a relayer unpause transaction"))
        .subcommand(
            Command::new("setWhitelistActive").about("Send a set whitelist active transaction"),
        )
        .subcommand(
            Command::new("setWhitelistInactive").about("Send a set whitelist inactive transaction"),
        )
        .subcommand(
            Command::new("addToWhitelist")
                .about("Send an add to whitelist transaction")
                .arg(
                    Arg::new("entry_pk")
                        .required(true)
                        .value_name("ENTRY_PK")
                        .takes_value(true)
                        .help("Entry public key"),
                ),
        )
        .subcommand(
            Command::new("removeFromWhitelist")
                .about("Send a remove from whitelist transaction")
                .arg(
                    Arg::new("entry_pk")
                        .required(true)
                        .value_name("ENTRY_PK")
                        .takes_value(true)
                        .help("Entry public key"),
                ),
        )
        .get_matches();

    let (command, matches) = app_matches.subcommand().unwrap();
    let mut wallet_manager: Option<Rc<RemoteWalletManager>> = None;

    let config = {
        let cli_config = if let Some(config_file) = matches.value_of("config_file") {
            solana_cli_config::Config::load(config_file).unwrap_or_default()
        } else {
            solana_cli_config::Config::default()
        };

        let default_signer = DefaultSigner::new(
            "keypair",
            matches
                .value_of("keypair")
                .map(|s| s.to_string())
                .unwrap_or_else(|| cli_config.keypair_path.clone()),
        );

        let json_rpc_url = normalize_to_url_if_moniker(
            matches
                .get_one::<String>("json_rpc_url")
                .unwrap_or(&cli_config.json_rpc_url),
        );

        let websocket_url = solana_cli_config::Config::compute_websocket_url(&json_rpc_url);

        Config {
            commitment_config: CommitmentConfig::confirmed(),
            json_rpc_url,
            verbose: matches.is_present("verbose"),
            websocket_url,
            default_signer: default_signer
                .signer_from_path(matches, &mut wallet_manager)
                .unwrap_or_else(|err| {
                    eprintln!("error: {err}");
                    exit(1);
                }),
        }
    };
    solana_logger::setup_with_default("solana=info");

    if config.verbose {
        println!("JSON RPC URL: {}", config.json_rpc_url);
        println!("Websocket URL: {}", config.websocket_url);
    }

    let rpc_client =
        RpcClient::new_with_commitment(config.json_rpc_url.clone(), config.commitment_config);

    match (command, matches) {
        ("initializeContract", arg_matches) => {
            let relayer_pk = pubkey_of(arg_matches, "relayer_pk").unwrap();
            let fee_collector = pubkey_of(arg_matches, "fee_collector_pk").unwrap();

            let mint_of_token_whitelisted =
                pubkey_of(arg_matches, "mint_of_token_whitelisted").unwrap();

            let minimum_deposit = arg_matches.get_one::<String>("minimum_deposit").unwrap();

            let maximum_deposit = arg_matches.get_one::<String>("maximum_deposit").unwrap();

            let fee_amount = arg_matches.get_one::<String>("fee_amount").unwrap();

            let signature = process_initialize_contract(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                relayer_pk,
                fee_collector,
                mint_of_token_whitelisted,
                minimum_deposit.parse::<u64>().unwrap(),
                maximum_deposit.parse::<u64>().unwrap(),
                fee_amount.parse::<u64>().unwrap(),
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });
            println!("Signature: {signature}");
        }
        ("updateRelayer", arg_matches) => {
            let relayer_pk = pubkey_of(arg_matches, "relayer_pk").unwrap();

            let signature = process_update_relayer(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                relayer_pk,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });
            println!("Signature: {signature}");
        }
        ("updateWhitelistedMint", arg_matches) => {
            let mint_of_token_whitelisted =
                pubkey_of(arg_matches, "mint_of_token_whitelisted").unwrap();

            let signature = process_update_whitelisted_mint(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                mint_of_token_whitelisted,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("addLiquidity", arg_matches) => {
            let amount = arg_matches.get_one::<String>("amount").unwrap();

            let mint_of_token_sent = pubkey_of(arg_matches, "mint_of_token_sent").unwrap();

            let signature = process_add_liquidity(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                amount.parse::<u64>().unwrap(),
                mint_of_token_sent,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("removeLiquidity", arg_matches) => {
            let amount = arg_matches.get_one::<String>("amount").unwrap();

            let mint_of_token_sent = pubkey_of(arg_matches, "mint_of_token_sent").unwrap();

            let signature = process_remove_liquidity(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                amount.parse::<u64>().unwrap(),
                mint_of_token_sent,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("setDepositLimits", arg_matches) => {
            let minimum_deposit = arg_matches.get_one::<String>("minimum_deposit").unwrap();
            let maximum_deposit = arg_matches.get_one::<String>("maximum_deposit").unwrap();

            let signature = process_set_deposit_limits(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                minimum_deposit.parse::<u64>().unwrap(),
                maximum_deposit.parse::<u64>().unwrap(),
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("publicPause", _arg_matches) => {
            let signature = process_public_pause_contract(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("publicUnpause", _arg_matches) => {
            let signature = process_public_unpause_contract(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("relayerPause", _arg_matches) => {
            let signature = process_relayer_pause(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("relayerUnpause", _arg_matches) => {
            let signature = process_relayer_unpause(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }

        ("setWhitelistActive", _arg_matches) => {
            let signature = process_set_whitelist_active(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("setWhitelistInactive", _arg_matches) => {
            let signature = process_set_whitelist_inactive(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("addToWhitelist", arg_matches) => {
            let entry_pk = pubkey_of(arg_matches, "entry_pk").unwrap();

            let signature = process_add_to_whitelist(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                entry_pk,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        ("removeFromWhitelist", arg_matches) => {
            let entry_pk = pubkey_of(arg_matches, "entry_pk").unwrap();

            let signature = process_remove_from_whitelist(
                &rpc_client,
                config.default_signer.as_ref(),
                bridge_program::ID,
                entry_pk,
            )
            .await
            .unwrap_or_else(|err| {
                eprintln!("error: send transaction: {err}");
                exit(1);
            });

            println!("Signature: {signature}");
        }
        _ => unreachable!(),
    };

    Ok(())
}
