pub fn check_amount(amount: u64, decimals: u8) -> bool {
    let token_decimals = 10u64.pow(decimals as u32);

    amount % token_decimals == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_amount_test() {
        let mut check = check_amount(2u64 * 10u64.pow(16u32), 18u8);

        assert_eq!(check, false);

        check = check_amount(2u64 * 10u64.pow(18u32), 18u8);

        assert_eq!(check, true);

        check = check_amount(2111111111111111111u64, 18u8);

        assert_eq!(check, false);
    }
}
