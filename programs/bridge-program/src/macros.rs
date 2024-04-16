#[macro_export]
macro_rules! require_active {
    ($e:expr) => {
        require!(
            $e.state == crate::states::bridge::State::Active,
            crate::errors::Errors::ProgramIsPaused
        );
    };
}
