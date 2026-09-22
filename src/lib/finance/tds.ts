/**
 * `receivedAmount` is what actually hit the bank account after TDS was
 * withheld at source — not the pre-tax contracted value — so TDS is the
 * OTHER percentage, not a cut out of the received amount itself. e.g.
 * receiving ₹90,000 at a 10% TDS rate means ₹90,000 is the 90% received,
 * and the 10% still to claim via the certificate is ₹10,000
 * (receivedAmount/(1-rate) - receivedAmount), not ₹9,000.
 */
export function computeTds(receivedAmount: number, tdsPercentage: number): { tdsAmount: number; grossFee: number } {
  if (!receivedAmount || !tdsPercentage || tdsPercentage <= 0 || tdsPercentage >= 100) {
    return { tdsAmount: 0, grossFee: receivedAmount }
  }
  const grossFee = receivedAmount / (1 - tdsPercentage / 100)
  return { tdsAmount: grossFee - receivedAmount, grossFee }
}
