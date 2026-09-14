// Helper for expect-revert tests WITHOUT burning a nonce (NonceManager bug workaround).
// Usage: const reverted = await expectRevert(aliceReg.submitAction(...));
async function expectRevert(promiseOrCall) {
  try {
    // staticCall path: dry-run, no tx, no nonce burned
    if (promiseOrCall.staticCall) {
      await promiseOrCall.staticCall();
    } else {
      await promiseOrCall;
    }
    return false; // did NOT revert
  } catch {
    return true; // reverted as expected
  }
}

module.exports = { expectRevert };
