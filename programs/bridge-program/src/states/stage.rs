#[derive(Clone, Copy, PartialEq)]
pub enum Stage {
    BridgeInitialized,
    BridgeComplete,
}

impl Stage {
    pub fn to_code(&self) -> u8 {
        match self {
            Stage::BridgeInitialized => 1,
            Stage::BridgeComplete => 2,
        }
    }
}
