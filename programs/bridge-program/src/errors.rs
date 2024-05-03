use anchor_lang::error_code;

#[error_code]
pub enum Errors {
    #[msg("Program is paused")]
    ProgramIsPaused,
    #[msg("Payment amount not in accepted range")]
    PaymentAmountNotInAcceptedRange,
}
