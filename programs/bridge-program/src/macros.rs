#[macro_export]
macro_rules! require_active {
    ($e:expr) => {
        require!(
            $e.state == crate::states::bridge::State::Active.to_code(),
            crate::errors::Errors::ProgramIsPaused
        );
    };
}
