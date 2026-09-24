// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISylToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function registry() external view returns (address);
}

/// @title EcoActionRegistry — SYLORA's on-chain logbook of eco-actions
/// @notice Review design:
///         - The queue server hashes uploaded image bytes; a verifier reviews
///           the off-chain request and records a final decision on-chain.
///         - Participant wallet ownership is not proven by a signature.
///         - Cooldown per action type + max pending → anti-spam / anti-sybil
///         - Rewards only leave the sponsor pool → solvent by design
///         - Burn-on-redeem → $SYL has real utility and deflationary sink
contract EcoActionRegistry {
    // ------------------------------------------------------------------
    // Constants (PRD §5.2–5.3)
    // ------------------------------------------------------------------
    uint256 public constant REWARD         = 50 * 1e18; // flat reward per verified action
    uint256 public constant COOLDOWN       = 24 hours;  // per (user, actionType)
    uint256 public constant MAX_PENDING    = 3;         // max concurrent pending per user
    uint256 public constant STREAK_WINDOW   = 72 hours;  // gap that keeps a streak alive
    uint256 public constant MIN_REDEEM     = 50 * 1e18; // min $SYL per voucher redeem
    uint256 public constant MAX_DESCRIPTION = 280;      // UTF-8 bytes

    ISylToken public syl;
    address public owner;

    enum Status { Pending, Verified, Rejected }

    struct Action {
        address submitter;
        string  actionType;    // eco-action or social-challenge identifier
        string  description;  // max 280 chars
        bytes32 imageHash;    // keccak256(image bytes) — proof locked at submit time
        uint64  submittedAt;
        Status  status;
        address verifier;     // set when Verified/Rejected
        uint256 rewardAmount; // 0 until Verified (= REWARD)
        uint16  streak;      // submitter's streak at verification time
    }

    bytes32[] public allActions;                 // every action id, in order
    mapping(bytes32 => Action) public actions;   // id => Action
    mapping(address => bytes32[]) public userActions;

    mapping(address => mapping(string => uint256)) public lastSubmitAt; // cooldown key
    mapping(address => uint256) public pendingCount;                    // anti-spam
    mapping(address => uint256) public userStreak;                      // streak counter
    mapping(address => uint256) public lastVerifiedAt;                  // streak window key
    mapping(address => uint256) public voucherCount;                   // vouchers redeemed
    mapping(address => bool) public verifiers;                          // organizer role
    mapping(address => mapping(uint256 => bool)) public usedNonces;     // signed submissions
    mapping(bytes32 => bool) public reviewedRequests;                   // off-chain queue ids

    event ActionSubmitted(bytes32 indexed id, address indexed submitter, string actionType, bytes32 imageHash, uint64 submittedAt);
    event ActionVerified(bytes32 indexed id, address indexed submitter, address indexed verifier, uint256 reward, uint16 streak);
    event ActionRejected(bytes32 indexed id, address indexed verifier, string reason);
    event VoucherRedeemed(address indexed user, uint256 voucherId, uint256 sylAmount, uint64 at);
    event PoolToppedUp(address indexed sponsor, uint256 amount);
    event VerifierUpdated(address indexed verifier, bool granted);

    error NotOwner();
    error NotVerifier();
    error TokenNotSet();
    error TokenAlreadySet();
    error NotOurToken();
    error InvalidActionType();
    error EmptyDescription();
    error DescriptionTooLong();
    error TooManyPending();
    error CooldownActive();
    error NotPending();
    error PoolEmpty();
    error BelowMinRedeem();
    error InvalidSubmitter();
    error InvalidSignature();
    error SignatureExpired();
    error SignatureAlreadyUsed();
    error RequestAlreadyReviewed();
    error InvalidRequestId();

    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SUBMIT_TYPEHASH = keccak256("SubmitAction(address submitter,string actionType,string description,bytes32 imageHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256("SYLORA");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant MAX_VALID_S = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyVerifier() {
        if (!verifiers[msg.sender]) revert NotVerifier();
        _;
    }

    /// @param seedDemo true → pre-populate 3 VERIFIED display actions so judges
    ///                 never land on an empty UI (PRD §5.4). No tokens move.
    constructor(bool seedDemo) {
        owner = msg.sender;
        verifiers[msg.sender] = true; // deployer is the first verifier (organizer)
        if (seedDemo) _seedDemoActions();
    }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    /// @notice Wire the token. Call AFTER deploying SylToken(this address).
    ///         Cross-checks token.registry() == this so a wrong token cannot be set.
    function setToken(address token) external onlyOwner {
        if (address(syl) != address(0)) revert TokenAlreadySet();
        syl = ISylToken(token);
        if (syl.registry() != address(this)) revert NotOurToken();
    }

    function setVerifier(address v, bool granted) external onlyOwner {
        verifiers[v] = granted;
        emit VerifierUpdated(v, granted);
    }

    /// @notice Sponsor top-up of the reward pool (PRD §5.3).
    ///         Requires the sponsor to have approved this registry first.
    ///         NOTE: a plain $SYL transfer to this contract works too —
    ///         the pool is simply the registry's token balance.
    function topUpPool(uint256 amount) external onlyOwner {
        if (address(syl) == address(0)) revert TokenNotSet();
        syl.transferFrom(msg.sender, address(this), amount);
        emit PoolToppedUp(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Submitter flow (PRD §5.2)
    // ------------------------------------------------------------------

    /// @notice Submit an eco-action with a hashed photo proof.
    /// @param imageHash keccak256 of the photo BYTES, hashed client-side before
    ///                   upload — the proof is locked at submission time.
    function submitAction(
        string calldata actionType,
        string calldata description,
        bytes32 imageHash
    ) external returns (bytes32 id) {
        return _submitAction(msg.sender, actionType, description, imageHash);
    }

    /// @notice A verifier pays gas for a wallet-signed action request.
    function submitActionFor(
        address submitter,
        string calldata actionType,
        string calldata description,
        bytes32 imageHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external onlyVerifier returns (bytes32 id) {
        if (submitter == address(0)) revert InvalidSubmitter();
        if (block.timestamp > deadline) revert SignatureExpired();
        if (usedNonces[submitter][nonce]) revert SignatureAlreadyUsed();
        _requireSignedAction(submitter, actionType, description, imageHash, nonce, deadline, signature);
        usedNonces[submitter][nonce] = true;
        return _submitAction(submitter, actionType, description, imageHash);
    }

    function _requireSignedAction(
        address submitter,
        string calldata actionType,
        string calldata description,
        bytes32 imageHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) private view {
        bytes32 structHash = keccak256(abi.encode(
            SUBMIT_TYPEHASH,
            submitter,
            keccak256(bytes(actionType)),
            keccak256(bytes(description)),
            imageHash,
            nonce,
            deadline
        ));
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        if (_recoverSigner(digest, signature) != submitter) revert InvalidSignature();
    }

    function _submitAction(
        address submitter,
        string calldata actionType,
        string calldata description,
        bytes32 imageHash
    ) internal returns (bytes32 id) {
        _requireValidActionType(actionType);
        if (bytes(description).length == 0) revert EmptyDescription();
        if (bytes(description).length > MAX_DESCRIPTION) revert DescriptionTooLong();
        if (pendingCount[submitter] >= MAX_PENDING) revert TooManyPending();
        if (block.timestamp < lastSubmitAt[submitter][actionType] + COOLDOWN) revert CooldownActive();

        lastSubmitAt[submitter][actionType] = block.timestamp;
        pendingCount[submitter] += 1;

        id = keccak256(abi.encodePacked(submitter, imageHash, block.timestamp, userActions[submitter].length));
        actions[id] = Action({
            submitter: submitter,
            actionType: actionType,
            description: description,
            imageHash: imageHash,
            submittedAt: uint64(block.timestamp),
            status: Status.Pending,
            verifier: address(0),
            rewardAmount: 0,
            streak: 0
        });
        allActions.push(id);
        userActions[submitter].push(id);

        emit ActionSubmitted(id, submitter, actionType, imageHash, uint64(block.timestamp));
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > MAX_VALID_S || (v != 27 && v != 28)) revert InvalidSignature();
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }

    /// @notice A verifier records one queue decision and pays the transaction fee.
    ///         The queue is off-chain; the verifier is trusted to select a recipient.
    function reviewQueuedAction(
        bytes32 requestId,
        address submitter,
        string calldata actionType,
        string calldata description,
        bytes32 imageHash,
        bool approved
    ) external onlyVerifier returns (bytes32 id) {
        if (requestId == bytes32(0)) revert InvalidRequestId();
        if (reviewedRequests[requestId]) revert RequestAlreadyReviewed();
        if (submitter == address(0)) revert InvalidSubmitter();
        _requireValidActionType(actionType);
        if (bytes(description).length == 0) revert EmptyDescription();
        if (bytes(description).length > MAX_DESCRIPTION) revert DescriptionTooLong();
        if (approved) {
            if (address(syl) == address(0)) revert TokenNotSet();
            if (block.timestamp < lastSubmitAt[submitter][actionType] + COOLDOWN) revert CooldownActive();
            if (syl.balanceOf(address(this)) < REWARD) revert PoolEmpty();
        }

        reviewedRequests[requestId] = true;
        id = keccak256(abi.encodePacked(address(this), requestId));
        uint16 streak = 0;
        if (approved) {
            lastSubmitAt[submitter][actionType] = block.timestamp;
            if (lastVerifiedAt[submitter] != 0 && block.timestamp - lastVerifiedAt[submitter] <= STREAK_WINDOW) {
                userStreak[submitter] += 1;
            } else {
                userStreak[submitter] = 1;
            }
            streak = uint16(userStreak[submitter]);
            lastVerifiedAt[submitter] = block.timestamp;
        }
        actions[id] = Action({
            submitter: submitter,
            actionType: actionType,
            description: description,
            imageHash: imageHash,
            submittedAt: uint64(block.timestamp),
            status: approved ? Status.Verified : Status.Rejected,
            verifier: msg.sender,
            rewardAmount: approved ? REWARD : 0,
            streak: streak
        });
        allActions.push(id);
        userActions[submitter].push(id);
        emit ActionSubmitted(id, submitter, actionType, imageHash, uint64(block.timestamp));
        if (approved) {
            syl.transfer(submitter, REWARD);
            emit ActionVerified(id, submitter, msg.sender, REWARD, streak);
        } else {
            emit ActionRejected(id, msg.sender, "Rejected by verifier");
        }
    }

    // ------------------------------------------------------------------
    // Verifier flow (PRD §5.2)
    // ------------------------------------------------------------------

    /// @notice Verify a pending action → pays REWARD $SYL from the pool + streak.
    function verifyAction(bytes32 actionId) external onlyVerifier {
        if (address(syl) == address(0)) revert TokenNotSet();
        Action storage a = actions[actionId];
        if (a.status != Status.Pending) revert NotPending();
        if (syl.balanceOf(address(this)) < REWARD) revert PoolEmpty();

        a.status = Status.Verified;
        a.verifier = msg.sender;
        a.rewardAmount = REWARD;

        // streak: keeps growing while verified actions stay within the window
        if (lastVerifiedAt[a.submitter] != 0 && block.timestamp - lastVerifiedAt[a.submitter] <= STREAK_WINDOW) {
            userStreak[a.submitter] += 1;
        } else {
            userStreak[a.submitter] = 1;
        }
        a.streak = uint16(userStreak[a.submitter]);
        lastVerifiedAt[a.submitter] = uint64(block.timestamp);
        pendingCount[a.submitter] -= 1;

        syl.transfer(a.submitter, REWARD);
        emit ActionVerified(actionId, a.submitter, msg.sender, REWARD, a.streak);
    }

    /// @notice Reject a pending action with a reason (reason lives in the event log).
    function rejectAction(bytes32 actionId, string calldata reason) external onlyVerifier {
        Action storage a = actions[actionId];
        if (a.status != Status.Pending) revert NotPending();
        a.status = Status.Rejected;
        a.verifier = msg.sender;
        pendingCount[a.submitter] -= 1;
        emit ActionRejected(actionId, msg.sender, reason);
    }

    // ------------------------------------------------------------------
    // Redeem sink (PRD §5.3)
    // ------------------------------------------------------------------

    /// @notice Burn $SYL for a voucher (e.g. "1 tree planted in your name").
    ///         Pulls + burns the tokens, so every redemption shrinks supply.
    function redeemVoucher(uint256 sylAmount) external {
        if (address(syl) == address(0)) revert TokenNotSet();
        if (sylAmount < MIN_REDEEM) revert BelowMinRedeem();

        uint256 voucherId = voucherCount[msg.sender] + 1;
        voucherCount[msg.sender] = voucherId;

        // Pull-and-burn in ONE call: tokens never touch the pool, so
        // poolBalance() always equals unclaimed rewards only.
        syl.burnFrom(msg.sender, sylAmount);

        emit VoucherRedeemed(msg.sender, voucherId, sylAmount, uint64(block.timestamp));
    }

    // ------------------------------------------------------------------
    // Views (PRD §5.2)
    // ------------------------------------------------------------------

    function getAction(bytes32 actionId) external view returns (Action memory) {
        return actions[actionId];
    }

    function getActionsByUser(address user) external view returns (bytes32[] memory) {
        return userActions[user];
    }

    function actionCount() external view returns (uint256) {
        return allActions.length;
    }

    /// @notice All pending action ids (O(n) — fine at MVP scale).
    function getPendingActions() external view returns (bytes32[] memory) {
        uint256 pending = 0;
        for (uint256 i = 0; i < allActions.length; i++) {
            if (actions[allActions[i]].status == Status.Pending) pending++;
        }
        bytes32[] memory out = new bytes32[](pending);
        uint256 j = 0;
        for (uint256 i = 0; i < allActions.length; i++) {
            if (actions[allActions[i]].status == Status.Pending) out[j++] = allActions[i];
        }
        return out;
    }

    /// @notice Public reward pool balance — SYLORA's transparent public ledger.
    function poolBalance() external view returns (uint256) {
        return syl.balanceOf(address(this));
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    bytes32 private constant T_TREE   = keccak256("tree_planting");
    bytes32 private constant T_BEACH = keccak256("beach_cleanup");
    bytes32 private constant T_RECY  = keccak256("recycle");
    bytes32 private constant T_COMP  = keccak256("compost");
    bytes32 private constant T_OTHER = keccak256("other");
    bytes32 private constant T_FOLLOW_X  = keccak256("follow_x");
    bytes32 private constant T_LIKE_X    = keccak256("like_x");
    bytes32 private constant T_COMMENT_X = keccak256("comment_x");
    bytes32 private constant T_REPOST_X  = keccak256("repost_x");
    bytes32 private constant T_ECO_POST_X = keccak256("eco_post_x");

    function supportsActionType(string calldata actionType) public pure returns (bool) {
        bytes32 t = keccak256(bytes(actionType));
        return t == T_TREE || t == T_BEACH || t == T_RECY || t == T_COMP || t == T_OTHER ||
            t == T_FOLLOW_X || t == T_LIKE_X || t == T_COMMENT_X || t == T_REPOST_X ||
            t == T_ECO_POST_X;
    }

    function _requireValidActionType(string calldata actionType) internal pure {
        if (!supportsActionType(actionType)) revert InvalidActionType();
    }

    /// @dev 3 pre-populated VERIFIED display actions (PRD §5.4 mock data).
    ///      Token is not wired yet at construction → rewardAmount stays 0.
    ///      These are display-only entries; the demo is honest because real
    ///      actions come with real on-chain hashes and rewards.
    function _seedDemoActions() private {
        string[3] memory types = ["tree_planting", "beach_cleanup", "recycle"];
        string[3] memory descs = [
            "Demo entry: planted 3 mangrove seedlings at the riverside with a local community group.",
            "Demo entry: collected 4.2 kg of plastic waste during a weekend beach cleanup.",
            "Demo entry: sorted and dropped off 12 kg of recyclables at the neighborhood waste bank."
        ];
        for (uint256 i = 0; i < 3; i++) {
            bytes32 id = keccak256(abi.encodePacked("SYLORA-DEMO-", i, block.timestamp));
            userStreak[owner] = uint16(i + 1);
            actions[id] = Action({
                submitter: owner,
                actionType: types[i],
                description: descs[i],
                imageHash: keccak256(abi.encodePacked("sylora-demo-image-", i)),
                submittedAt: uint64(block.timestamp),
                status: Status.Verified,
                verifier: owner,
                rewardAmount: 0,
                streak: uint16(i + 1)
            });
            allActions.push(id);
            userActions[owner].push(id);
            lastVerifiedAt[owner] = uint64(block.timestamp);
        }
    }
}
