const API_URL = "https://api.smart-safe.online/api";

export async function telegramAuth(payload) {
  const res = await fetch(`${API_URL}/auth/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

export async function getProfile(token) {
  const res = await fetch(`${API_URL}/user/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getPlans() {
  const res = await fetch(`${API_URL}/plans`);
  return res.json();
}

export async function getTransactions(token) {
  const res = await fetch(`${API_URL}/user/transactions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function openSafe(token, planCode, amount) {
  const res = await fetch(`${API_URL}/safe/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_code: planCode,
      amount,
    }),
  });

  return res.json();
}

export async function transferToMain(token, fromBalance, amount) {
  const res = await fetch(`${API_URL}/user/transfer-to-main`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      from_balance: fromBalance,
      amount,
    }),
  });

  return res.json();
}

export async function getReferralDashboard(token) {
  const res = await fetch(`${API_URL}/referrals/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getSecretSafeInfo(token) {
  const res = await fetch(`${API_URL}/secret/info`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function activateSecretSafe(token, code) {
  const res = await fetch(`${API_URL}/secret/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      code,
    }),
  });

  return res.json();
}

export async function createWithdraw(
  token,
  network,
  walletAddress,
  amount
) {
  const res = await fetch(`${API_URL}/withdraw/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      network,
      wallet_address: walletAddress,
      amount,
    }),
  });

  return res.json();
}

export async function getMyWithdrawals(token) {
  const res = await fetch(`${API_URL}/withdraw/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function cancelWithdraw(token, withdrawalId) {
  const res = await fetch(
    `${API_URL}/withdraw/cancel/${withdrawalId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.json();
}

export async function createDeposit(token, network, amount) {
  const res = await fetch(`${API_URL}/deposit/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      network,
      amount,
    }),
  });

  return res.json();
}

export async function getMyDeposits(token) {
  const res = await fetch(`${API_URL}/deposit/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

// ==================== ADMIN ====================

export async function getAdminStats(token) {
  const res = await fetch(`${API_URL}/admin/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminUsers(token) {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminUser(token, userId) {
  const res = await fetch(`${API_URL}/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminWithdrawals(token) {
  const res = await fetch(`${API_URL}/admin/withdrawals`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminPaymentDeposits(token) {
  const res = await fetch(`${API_URL}/admin/payment-deposits`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminUserDeposits(token) {
  const res = await fetch(`${API_URL}/admin/user-deposits`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function getAdminLogs(token) {
  const res = await fetch(`${API_URL}/admin/logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function changeUserBalance(
  token,
  userId,
  balanceType,
  operation,
  amount,
  comment
) {
  const res = await fetch(
    `${API_URL}/admin/users/${userId}/balance`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        balance_type: balanceType,
        operation,
        amount,
        comment,
      }),
    }
  );

  return res.json();
}

export async function blockUser(
  token,
  userId,
  isBlocked,
  comment
) {
  const res = await fetch(
    `${API_URL}/admin/users/${userId}/block`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_blocked: isBlocked,
        comment,
      }),
    }
  );

  return res.json();
}

export async function setAdmin(
  token,
  userId,
  isAdmin,
  comment
) {
  const res = await fetch(
    `${API_URL}/admin/users/${userId}/admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_admin: isAdmin,
        comment,
      }),
    }
  );

  return res.json();
}

export async function moveUserStructure(
  token,
  userId,
  referrer,
  comment
) {
  const res = await fetch(
    `${API_URL}/admin/users/${userId}/change-referrer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        referrer,
        comment,
      }),
    }
  );

  return res.json();
}

export async function approveWithdrawal(
  token,
  withdrawalId,
  adminComment
) {
  const res = await fetch(
    `${API_URL}/admin/withdrawals/${withdrawalId}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        admin_comment: adminComment,
      }),
    }
  );

  return res.json();
}

export async function rejectWithdrawal(
  token,
  withdrawalId,
  adminComment
) {
  const res = await fetch(
    `${API_URL}/admin/withdrawals/${withdrawalId}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        admin_comment: adminComment,
      }),
    }
  );

  return res.json();
}

// ==================== SECRET SAFE ADMIN ====================

export async function getAdminSecretCodes(token) {
  const res = await fetch(`${API_URL}/secret/admin/codes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

export async function updateAdminSecretFund(token, displayedFund) {
  const res = await fetch(`${API_URL}/secret/admin/fund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayed_fund: displayedFund,
    }),
  });

  return res.json();
}

export async function createAdminSecretCode(token, userId, code, amount, expiresAt) {
  const res = await fetch(`${API_URL}/secret/admin/codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: userId,
      code,
      amount,
      expires_at: expiresAt || null,
    }),
  });

  return res.json();
}
