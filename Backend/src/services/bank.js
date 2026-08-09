'use strict';

function createBankService({ id, now, httpError }) {
  async function executeTransfer(payoutRequest) {
    const payload = {
      reference: payoutRequest.id,
      amount: payoutRequest.amount,
      method: payoutRequest.method,
      bankAccount: payoutRequest.bankAccount
    };
    if (process.env.EXPOCRAFT_BANK_API_URL) {
      const response = await fetch(`${process.env.EXPOCRAFT_BANK_API_URL.replace(/\/$/, '')}/transfers`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.EXPOCRAFT_BANK_API_KEY ? { authorization: `Bearer ${process.env.EXPOCRAFT_BANK_API_KEY}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw httpError(502, 'bank_transfer_failed', 'Bank transfer failed.', data);
      return { provider: 'bank_http', providerRef: data.id || data.reference || id('bank'), status: data.status || 'submitted', raw: data, createdAt: now() };
    }
    return { provider: 'mock_bank', providerRef: id('bank'), status: 'submitted', raw: payload, createdAt: now() };
  }

  return { executeTransfer };
}

module.exports = { createBankService };
