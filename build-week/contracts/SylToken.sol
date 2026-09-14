// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SylToken — the $SYL reward token of SYLORA
/// @notice Tokenomics (anti-inflation, lesson from Toucan/KlimaDAO zombie credits):
///         1. Supply is HARD-CAPPED at 1,000,000 SYL, minted ONCE at deployment
///            directly into the reward pool (EcoActionRegistry).
///         2. There is NO mint function AT ALL — nobody can ever print more $SYL.
///            Not the owner, not the registry, nobody. Verify it: read the code.
///         3. Rewards only flow OUT of the pool as eco-actions get verified.
///         4. $SYL is BURNED on voucher redeem, so circulating supply shrinks over time.
///         This is the exact opposite of a "poin bank sampah" that can be printed silently.
contract SylToken {
    // ------------------------------------------------------------------
    // ERC-20 metadata (fixed)
    // ------------------------------------------------------------------
    string public constant name = "SYLORA Token";
    string public constant symbol = "SYL";
    uint8  public constant decimals = 18;

    /// @notice Hard cap — on-chain, auditable, can never be exceeded.
    uint256 public constant MAX_SUPPLY = 1_000_000 * 1e18;

    /// @notice The reward pool contract. Set once at deployment; the full
    ///         capped supply is minted straight into it. Immutable forever.
    address public immutable registry;

    /// @notice Total $SYL burned so far (burn-on-redeem sink) — public ledger metric.
    uint256 public totalBurned;

    uint256 public totalSupply; // starts at MAX_SUPPLY, decreases on burn

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    /// @param _registry the EcoActionRegistry that will hold the whole supply as reward pool.
    ///                   Deploy order: 1) EcoActionRegistry(seed)  2) SylToken(registry address)
    ///                                 3) registry.setToken(token address)
    constructor(address _registry) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = _registry;
        totalSupply = MAX_SUPPLY;
        balanceOf[_registry] = MAX_SUPPLY;
        emit Transfer(address(0), _registry, MAX_SUPPLY);
    }

    // ------------------------------------------------------------------
    // Burn — the deflationary sink (PRD §5.3)
    // ------------------------------------------------------------------

    /// @notice Burns the caller's own $SYL.
    function burn(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        _burn(msg.sender, amount);
    }

    /// @notice Burns $SYL owned by `from`, spending the caller's allowance.
    ///         Used by EcoActionRegistry.redeemVoucher() so a voucher redeem
    ///         is ONE transaction: pull-and-burn the user's $SYL. The registry
    ///         never keeps the redeemed tokens — pool balance is untouched.
    function burnFrom(address from, uint256 amount) external {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] = allowed - amount;
        _burn(from, amount);
    }

    function _burn(address from, uint256 amount) private {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        totalBurned += amount;
        emit Transfer(from, address(0), amount);
    }

    // ------------------------------------------------------------------
    // ERC-20 core
    // ------------------------------------------------------------------
    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
