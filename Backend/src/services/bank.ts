'use strict';

function createBankService({ id, now, httpError }) {
  function normalizeBankAccount(bankAccount) {
    if (!bankAccount || typeof bankAccount !== 'object') return null;
    return {
      bankName: bankAccount.bankName || bankAccount.bank || null,
      accountName: bankAccount.accountName || bankAccount.name || null,
      accountNumber: bankAccount.accountNumber || bankAccount.number || null,
      accountLast4: bankAccount.accountLast4 || bankAccount.last4 || (bankAccount.accountNumber ? String(bankAccount.accountNumber).slice(-4) : null)
    };
  }

  async function executeTransfer(payoutRequest) {
    const bankAccount = normalizeBankAccount(payoutRequest.bankAccount);
    const payload = {
      reference: payoutRequest.id,
      amount: payoutRequest.amount,
      method: payoutRequest.method,
      bankAccount
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
    return {
      provider: 'manual_bank',
      providerRef: null,
      status: 'pending_manual',
      requiresManualSettlement: true,
      raw: payload,
      createdAt: now()
    };
  }

  return { executeTransfer, normalizeBankAccount };
}

module.exports = { createBankService };
