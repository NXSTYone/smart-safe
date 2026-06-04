import { useEffect, useState } from "react";

import {
  getAdminStats,
  getAdminUsers,
  getAdminWithdrawals,
  getAdminPaymentDeposits,
  getAdminUserDeposits,
  getAdminLogs,
  changeUserBalance,
  blockUser,
  setAdmin,
  moveUserStructure,
  approveWithdrawal,
  rejectWithdrawal,
  getSecretSafeInfo,
  getAdminSecretCodes,
  updateAdminSecretFund,
  createAdminSecretCode,
} from "../api";

export default function AdminPanel({ token }) {
  const [tab, setTab] = useState("stats");

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [paymentDeposits, setPaymentDeposits] = useState([]);
  const [userDeposits, setUserDeposits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [secretSafe, setSecretSafe] = useState(null);
  const [secretCodes, setSecretCodes] = useState([]);

  const [loading, setLoading] = useState(false);

  const [balanceForm, setBalanceForm] = useState({
    userId: "",
    balanceType: "main",
    operation: "add",
    amount: "",
    comment: "",
  });

  const [structureForm, setStructureForm] = useState({
    userId: "",
    referrer: "",
    comment: "",
  });

  const [withdrawForm, setWithdrawForm] = useState({
    withdrawalId: "",
    comment: "",
  });

  const [secretFundForm, setSecretFundForm] = useState("");
  const [secretCodeForm, setSecretCodeForm] = useState({
    userId: "",
    code: "",
    amount: "",
    expiresAt: "",
  });

  const loadAdminData = async () => {
    if (!token) return;

    setLoading(true);

    try {
      const [
        statsResult,
        usersResult,
        withdrawalsResult,
        paymentDepositsResult,
        userDepositsResult,
        logsResult,
        secretInfoResult,
        secretCodesResult,
      ] = await Promise.all([
        getAdminStats(token),
        getAdminUsers(token),
        getAdminWithdrawals(token),
        getAdminPaymentDeposits(token),
        getAdminUserDeposits(token),
        getAdminLogs(token),
        getSecretSafeInfo(token),
        getAdminSecretCodes(token),
      ]);

      if (statsResult.success) setStats(statsResult.stats);
      if (usersResult.success) setUsers(usersResult.users || []);
      if (withdrawalsResult.success) setWithdrawals(withdrawalsResult.withdrawals || []);
      if (paymentDepositsResult.success) setPaymentDeposits(paymentDepositsResult.deposits || []);
      if (userDepositsResult.success) setUserDeposits(userDepositsResult.deposits || []);
      if (logsResult.success) setLogs(logsResult.logs || []);
      if (secretInfoResult.success) {
        setSecretSafe(secretInfoResult.secret_safe);
        setSecretFundForm(String(secretInfoResult.secret_safe?.displayed_fund || ""));
      }
      if (secretCodesResult.success) setSecretCodes(secretCodesResult.codes || []);
    } catch (error) {
      console.error("Admin load error:", error);
      alert("Ошибка загрузки админки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  const formatMoney = (value) => `${Number(value || 0).toFixed(2)} USDT`;

  const formatDate = (value) => {
    if (!value) return "—";

    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserName = (user) => {
    if (!user) return "—";
    if (user.telegram_username) return `@${user.telegram_username}`;
    if (user.first_name || user.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    return String(user.telegram_id || user.id || "—");
  };

  const handleBalanceChange = async () => {
    if (!balanceForm.userId || !balanceForm.amount || !balanceForm.comment) {
      alert("Заполни userId, сумму и комментарий");
      return;
    }

    const result = await changeUserBalance(
      token,
      balanceForm.userId,
      balanceForm.balanceType,
      balanceForm.operation,
      Number(balanceForm.amount),
      balanceForm.comment
    );

    if (!result.success) {
      alert(result.message || "Ошибка изменения баланса");
      return;
    }

    alert("Баланс изменён");
    setBalanceForm({
      userId: "",
      balanceType: "main",
      operation: "add",
      amount: "",
      comment: "",
    });
    await loadAdminData();
  };

  const handleBlockUser = async (userId, isBlocked) => {
    const comment = prompt(
      isBlocked
        ? "Причина блокировки пользователя:"
        : "Причина разблокировки пользователя:"
    );

    if (comment === null) return;

    const result = await blockUser(token, userId, isBlocked, comment || "Без комментария");

    if (!result.success) {
      alert(result.message || "Ошибка изменения блокировки");
      return;
    }

    await loadAdminData();
  };

  const handleSetAdmin = async (userId, isAdmin) => {
    const comment = prompt(
      isAdmin
        ? "Комментарий к назначению админом:"
        : "Комментарий к снятию админки:"
    );

    if (comment === null) return;

    const result = await setAdmin(token, userId, isAdmin, comment || "Без комментария");

    if (!result.success) {
      alert(result.message || "Ошибка изменения прав администратора");
      return;
    }

    await loadAdminData();
  };

  const handleMoveStructure = async () => {
    if (!structureForm.userId || !structureForm.comment) {
      alert("Заполни userId и комментарий");
      return;
    }

    const result = await moveUserStructure(
      token,
      structureForm.userId,
      structureForm.referrer,
      structureForm.comment
    );

    if (!result.success) {
      alert(result.message || "Ошибка переноса структуры");
      return;
    }

    alert("Пользователь перенесён");
    setStructureForm({
      userId: "",
      referrer: "",
      comment: "",
    });
    await loadAdminData();
  };

  const handleApproveWithdrawal = async (withdrawalIdFromCard = null) => {
    const withdrawalId = withdrawalIdFromCard || withdrawForm.withdrawalId;

    if (!withdrawalId) {
      alert("Укажи ID заявки");
      return;
    }

    const comment = withdrawalIdFromCard
      ? prompt("Комментарий к подтверждению вывода:")
      : withdrawForm.comment;

    if (comment === null) return;

    const result = await approveWithdrawal(
      token,
      withdrawalId,
      comment || "Вывод подтверждён администратором"
    );

    if (!result.success) {
      alert(result.message || "Ошибка подтверждения вывода");
      return;
    }

    alert("Вывод отправлен в CryptocurrencyAPI");
    setWithdrawForm({
      withdrawalId: "",
      comment: "",
    });
    await loadAdminData();
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const comment = prompt("Причина отклонения вывода:");

    if (comment === null) return;

    const result = await rejectWithdrawal(token, withdrawalId, comment || "Отклонено администратором");

    if (!result.success) {
      alert(result.message || "Ошибка отклонения вывода");
      return;
    }

    await loadAdminData();
  };

  const handleUpdateSecretFund = async () => {
    if (!secretFundForm || Number(secretFundForm) < 0) {
      alert("Укажи корректный фонд Secret Safe");
      return;
    }

    const result = await updateAdminSecretFund(token, Number(secretFundForm));

    if (!result.success) {
      alert(result.message || "Ошибка изменения фонда Secret Safe");
      return;
    }

    alert("Фонд Secret Safe обновлён");
    await loadAdminData();
  };

  const handleCreateSecretCode = async () => {
    if (!secretCodeForm.userId || !secretCodeForm.code || !secretCodeForm.amount) {
      alert("Заполни User ID, код и сумму");
      return;
    }

    const result = await createAdminSecretCode(
      token,
      secretCodeForm.userId,
      secretCodeForm.code.trim(),
      Number(secretCodeForm.amount),
      secretCodeForm.expiresAt || null
    );

    if (!result.success) {
      alert(result.message || "Ошибка создания кода Secret Safe");
      return;
    }

    alert("Код Secret Safe создан");
    setSecretCodeForm({
      userId: "",
      code: "",
      amount: "",
      expiresAt: "",
    });
    await loadAdminData();
  };


  const tabs = [
    { key: "stats", label: "Статистика" },
    { key: "users", label: "Пользователи" },
    { key: "finance", label: "Финансы" },
    { key: "withdrawals", label: "Выводы" },
    { key: "deposits", label: "Пополнения" },
    { key: "safes", label: "Сейфы" },
    { key: "secret", label: "Secret Safe" },
    { key: "logs", label: "Логи" },
  ];

  return (
    <section className="px-5 mt-8 pb-40">
      <div className="mb-6">
        <p className="neon-label text-[13px]">SMART SAFE</p>

        <h2 className="mt-3 neon-title-purple text-[38px] leading-[1.05]">
          АДМИН
          <br />
          ПАНЕЛЬ
        </h2>

        <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
          Управление пользователями, балансами, структурами, пополнениями,
          выводами и логами проекта.
        </p>

        <button
          onClick={loadAdminData}
          className="mt-5 w-full rounded-[18px] border border-[#00E5FF]/50 bg-[#00E5FF]/10 py-4 font-black text-[#00E5FF]"
        >
          {loading ? "ОБНОВЛЕНИЕ..." : "ОБНОВИТЬ ДАННЫЕ"}
        </button>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className="shrink-0 rounded-[16px] border px-4 py-3 text-[13px] font-black"
            style={{
              borderColor: tab === item.key ? "#39FF14" : "rgba(126,141,170,.25)",
              color: tab === item.key ? "#39FF14" : "#7E8DAA",
              background: tab === item.key ? "rgba(57,255,20,.10)" : "rgba(11,18,32,.75)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-3">
          <AdminStat label="Пользователи" value={stats?.total_users} color="#00E5FF" />
          <AdminStat label="Админы" value={stats?.admins} color="#7C3AED" />
          <AdminStat label="Заблокировано" value={stats?.blocked_users} color="#F87171" />
          <AdminStat label="Активные сейфы" value={stats?.active_safes} color="#39FF14" />
          <AdminStat label="Основной баланс" value={formatMoney(stats?.total_main_balance)} color="#39FF14" />
          <AdminStat label="Рабочий баланс" value={formatMoney(stats?.total_working_balance)} color="#00E5FF" />
          <AdminStat label="Реф. баланс" value={formatMoney(stats?.total_referral_balance)} color="#7C3AED" />
          <AdminStat label="Пополнено" value={formatMoney(stats?.total_deposits)} color="#39FF14" />
          <AdminStat label="Выведено" value={formatMoney(stats?.total_withdrawals)} color="#F87171" />
          <AdminStat label="Выводы pending" value={stats?.pending_withdrawals} color="#F59E0B" />
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          {users.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-[#00E5FF]/20 bg-[#0B1220]/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-black text-[#00E5FF]">
                    {getUserName(item)}
                  </p>

                  <p className="mt-1 text-[12px] text-[#7E8DAA]">
                    TG ID: {item.telegram_id}
                  </p>

                  <p className="mt-1 break-all text-[12px] text-[#7E8DAA]">
                    ID: {item.id}
                  </p>

                  <p className="mt-1 text-[12px] text-[#7E8DAA]">
                    Ref: {item.referral_code}
                  </p>

                  <p className="mt-1 text-[12px] text-[#7E8DAA]">
                    Пригласитель: {item.invited_by_username ? `@${item.invited_by_username}` : item.invited_by || "—"}
                  </p>
                </div>

                <div className="text-right">
                  {item.is_admin && <p className="text-[12px] font-black text-[#39FF14]">АДМИН</p>}
                  {item.is_blocked && <p className="text-[12px] font-black text-[#F87171]">БЛОК</p>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniBalance label="Основной" value={item.main_balance} color="#39FF14" />
                <MiniBalance label="Рабочий" value={item.working_balance} color="#00E5FF" />
                <MiniBalance label="Реф." value={item.referral_balance} color="#7C3AED" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBlockUser(item.id, !item.is_blocked)}
                  className="rounded-[14px] border border-[#F87171]/40 bg-[#F87171]/10 py-3 text-[12px] font-black text-[#F87171]"
                >
                  {item.is_blocked ? "РАЗБЛОК" : "БЛОК"}
                </button>

                <button
                  onClick={() => handleSetAdmin(item.id, !item.is_admin)}
                  className="rounded-[14px] border border-[#39FF14]/40 bg-[#39FF14]/10 py-3 text-[12px] font-black text-[#39FF14]"
                >
                  {item.is_admin ? "СНЯТЬ АДМИНА" : "СДЕЛАТЬ АДМИНОМ"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "finance" && (
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[#39FF14]/25 bg-[#0B1220]/80 p-4">
            <p className="text-[18px] font-black text-[#39FF14]">
              РУЧНОЕ ИЗМЕНЕНИЕ БАЛАНСА
            </p>

            <p className="mt-2 text-[13px] text-[#7E8DAA]">
              Все действия пишутся в admin_logs.
            </p>

            <AdminInput
              label="User ID"
              value={balanceForm.userId}
              onChange={(value) => setBalanceForm({ ...balanceForm, userId: value })}
              placeholder="UUID пользователя"
            />

            <AdminSelect
              label="Баланс"
              value={balanceForm.balanceType}
              onChange={(value) => setBalanceForm({ ...balanceForm, balanceType: value })}
              options={[
                { value: "main", label: "Основной" },
                { value: "working", label: "Рабочий" },
                { value: "referral", label: "Реферальный" },
              ]}
            />

            <AdminSelect
              label="Операция"
              value={balanceForm.operation}
              onChange={(value) => setBalanceForm({ ...balanceForm, operation: value })}
              options={[
                { value: "add", label: "Начислить +" },
                { value: "subtract", label: "Списать -" },
                { value: "set", label: "Установить =" },
              ]}
            />

            <AdminInput
              label="Сумма"
              type="number"
              value={balanceForm.amount}
              onChange={(value) => setBalanceForm({ ...balanceForm, amount: value })}
              placeholder="100"
            />

            <AdminInput
              label="Причина"
              value={balanceForm.comment}
              onChange={(value) => setBalanceForm({ ...balanceForm, comment: value })}
              placeholder="Например: корректировка пополнения"
            />

            <button
              onClick={handleBalanceChange}
              className="mt-5 w-full rounded-[18px] border border-[#39FF14]/60 bg-[#39FF14]/10 py-4 font-black text-[#39FF14]"
            >
              ИЗМЕНИТЬ БАЛАНС
            </button>
          </div>

          <div className="rounded-[24px] border border-[#7C3AED]/25 bg-[#0B1220]/80 p-4">
            <p className="text-[18px] font-black text-[#7C3AED]">
              ПЕРЕНОС ПО СТРУКТУРЕ
            </p>

            <p className="mt-2 text-[13px] text-[#7E8DAA]">
              Новый пригласитель: UUID, telegram_id, username или referral_code.
              Пустой referrer убирает пригласителя.
            </p>

            <AdminInput
              label="User ID"
              value={structureForm.userId}
              onChange={(value) => setStructureForm({ ...structureForm, userId: value })}
              placeholder="UUID пользователя"
            />

            <AdminInput
              label="Новый пригласитель"
              value={structureForm.referrer}
              onChange={(value) => setStructureForm({ ...structureForm, referrer: value })}
              placeholder="@username / telegram_id / referral_code / пусто"
            />

            <AdminInput
              label="Причина"
              value={structureForm.comment}
              onChange={(value) => setStructureForm({ ...structureForm, comment: value })}
              placeholder="Почему переносим"
            />

            <button
              onClick={handleMoveStructure}
              className="mt-5 w-full rounded-[18px] border border-[#7C3AED]/60 bg-[#7C3AED]/10 py-4 font-black text-[#7C3AED]"
            >
              ПЕРЕНЕСТИ ПОЛЬЗОВАТЕЛЯ
            </button>
          </div>
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[#F59E0B]/25 bg-[#0B1220]/80 p-4">
            <p className="text-[18px] font-black text-[#F59E0B]">
              АВТОМАТИЧЕСКОЕ ПОДТВЕРЖДЕНИЕ
            </p>

            <p className="mt-2 text-[13px] leading-relaxed text-[#7E8DAA]">
              Обычно подтверждай вывод кнопкой прямо в карточке заявки. Backend сам отправит USDT через CryptocurrencyAPI, а статус станет processing до IPN.
            </p>

            <AdminInput
              label="Withdrawal ID"
              value={withdrawForm.withdrawalId}
              onChange={(value) => setWithdrawForm({ ...withdrawForm, withdrawalId: value })}
              placeholder="UUID заявки, если подтверждаешь вручную"
            />

            <AdminInput
              label="Комментарий"
              value={withdrawForm.comment}
              onChange={(value) => setWithdrawForm({ ...withdrawForm, comment: value })}
              placeholder="Комментарий админа"
            />

            <button
              onClick={() => handleApproveWithdrawal()}
              className="mt-5 w-full rounded-[18px] border border-[#39FF14]/60 bg-[#39FF14]/10 py-4 font-black text-[#39FF14]"
            >
              ОТПРАВИТЬ В CRYPTOCURRENCYAPI
            </button>
          </div>

          {withdrawals.map((item) => (
            <AdminCard key={item.id} color={item.status === "pending" ? "#F59E0B" : "#7E8DAA"}>
              <p className="font-black text-[#F59E0B]">
                {formatMoney(item.amount)} · {item.network} · {item.status}
              </p>

              <p className="mt-2 text-[13px] text-[#7E8DAA]">
                {getUserName(item)} · {formatDate(item.created_at)}
              </p>

              <p className="mt-2 break-all text-[12px] text-[#7FE7FF]">
                ID: {item.id}
              </p>

              <p className="mt-2 break-all text-[12px] text-[#7FE7FF]">
                Кошелёк: {item.wallet_address}
              </p>

              {item.tx_hash && (
                <p className="mt-2 break-all text-[12px] text-[#39FF14]">
                  TX: {item.tx_hash}
                </p>
              )}

              {item.status === "pending" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleApproveWithdrawal(item.id)}
                    className="rounded-[14px] border border-[#39FF14]/50 bg-[#39FF14]/10 py-3 text-[12px] font-black text-[#39FF14]"
                  >
                    ПОДТВЕРДИТЬ
                  </button>

                  <button
                    onClick={() => handleRejectWithdrawal(item.id)}
                    className="rounded-[14px] border border-[#F87171]/50 bg-[#F87171]/10 py-3 text-[12px] font-black text-[#F87171]"
                  >
                    ОТКЛОНИТЬ
                  </button>
                </div>
              )}
            </AdminCard>
          ))}
        </div>
      )}

      {tab === "deposits" && (
        <div className="space-y-3">
          {paymentDeposits.map((item) => (
            <AdminCard key={item.id} color={item.status === "completed" ? "#39FF14" : "#F59E0B"}>
              <p className="font-black text-[#39FF14]">
                {formatMoney(item.amount)} · {item.network} · {item.status}
              </p>

              <p className="mt-2 text-[13px] text-[#7E8DAA]">
                {getUserName(item)} · {formatDate(item.created_at)}
              </p>

              <p className="mt-2 break-all text-[12px] text-[#7FE7FF]">
                Адрес: {item.address}
              </p>

              {item.tx_hash && (
                <p className="mt-2 break-all text-[12px] text-[#39FF14]">
                  TX: {item.tx_hash}
                </p>
              )}
            </AdminCard>
          ))}
        </div>
      )}

      {tab === "safes" && (
        <div className="space-y-3">
          {userDeposits.map((item) => (
            <AdminCard key={item.id} color={item.status === "active" ? "#39FF14" : "#7E8DAA"}>
              <p className="font-black text-[#00E5FF]">
                {item.plan_name || item.plan_code || "SAFE"} · {item.status}
              </p>

              <p className="mt-2 text-[13px] text-[#7E8DAA]">
                {getUserName(item)} · {formatDate(item.created_at)}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <p>Депозит: {formatMoney(item.amount)}</p>
                <p>Заработано: {formatMoney(item.earned_amount)}</p>
                <p>До X2: {formatMoney(item.max_return_amount)}</p>
                <p>Процент: {Number(item.total_percent || 0).toFixed(2)}%</p>
              </div>
            </AdminCard>
          ))}
        </div>
      )}


      {tab === "secret" && (
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[#7C3AED]/25 bg-[#0B1220]/80 p-4">
            <p className="text-[18px] font-black text-[#7C3AED]">
              ФОНД SECRET SAFE
            </p>

            <p className="mt-2 text-[13px] text-[#7E8DAA]">
              Текущий отображаемый фонд: {formatMoney(secretSafe?.displayed_fund)}
            </p>

            <AdminInput
              label="Новый фонд"
              type="number"
              value={secretFundForm}
              onChange={setSecretFundForm}
              placeholder="5000"
            />

            <button
              onClick={handleUpdateSecretFund}
              className="mt-5 w-full rounded-[18px] border border-[#7C3AED]/60 bg-[#7C3AED]/10 py-4 font-black text-[#7C3AED]"
            >
              ОБНОВИТЬ ФОНД
            </button>
          </div>

          <div className="rounded-[24px] border border-[#39FF14]/25 bg-[#0B1220]/80 p-4">
            <p className="text-[18px] font-black text-[#39FF14]">
              СОЗДАТЬ КОД
            </p>

            <AdminInput
              label="User ID"
              value={secretCodeForm.userId}
              onChange={(value) => setSecretCodeForm({ ...secretCodeForm, userId: value })}
              placeholder="UUID пользователя"
            />

            <AdminInput
              label="Код"
              value={secretCodeForm.code}
              onChange={(value) => setSecretCodeForm({ ...secretCodeForm, code: value })}
              placeholder="Например: SAFE500"
            />

            <AdminInput
              label="Сумма"
              type="number"
              value={secretCodeForm.amount}
              onChange={(value) => setSecretCodeForm({ ...secretCodeForm, amount: value })}
              placeholder="500"
            />

            <AdminInput
              label="Срок действия, необязательно"
              type="datetime-local"
              value={secretCodeForm.expiresAt}
              onChange={(value) => setSecretCodeForm({ ...secretCodeForm, expiresAt: value })}
              placeholder=""
            />

            <button
              onClick={handleCreateSecretCode}
              className="mt-5 w-full rounded-[18px] border border-[#39FF14]/60 bg-[#39FF14]/10 py-4 font-black text-[#39FF14]"
            >
              СОЗДАТЬ КОД
            </button>
          </div>

          <div className="space-y-3">
            {secretCodes.map((item) => (
              <AdminCard key={item.id} color={item.status === "active" ? "#39FF14" : "#7E8DAA"}>
                <p className="font-black text-[#39FF14]">
                  {item.code} · {formatMoney(item.amount)} · {item.status}
                </p>

                <p className="mt-2 text-[13px] text-[#7E8DAA]">
                  Пользователь: {getUserName(item)}
                </p>

                <p className="mt-1 break-all text-[12px] text-[#7FE7FF]">
                  User ID: {item.user_id}
                </p>

                <p className="mt-1 text-[12px] text-[#7E8DAA]">
                  Создан: {formatDate(item.created_at)}
                </p>

                {item.used_at && (
                  <p className="mt-1 text-[12px] text-[#7E8DAA]">
                    Использован: {formatDate(item.used_at)}
                  </p>
                )}

                {item.expires_at && (
                  <p className="mt-1 text-[12px] text-[#7E8DAA]">
                    Действует до: {formatDate(item.expires_at)}
                  </p>
                )}
              </AdminCard>
            ))}
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-3">
          {logs.map((item) => (
            <AdminCard key={item.id} color="#00E5FF">
              <p className="font-black text-[#00E5FF]">{item.action}</p>

              <p className="mt-2 text-[13px] text-[#7E8DAA]">
                Админ: {item.admin_username ? `@${item.admin_username}` : item.admin_telegram_id || "—"}
              </p>

              <p className="mt-1 text-[13px] text-[#7E8DAA]">
                Цель: {item.target_username ? `@${item.target_username}` : item.target_telegram_id || "—"}
              </p>

              <p className="mt-1 text-[13px] text-[#7E8DAA]">
                {formatDate(item.created_at)}
              </p>

              {item.comment && (
                <p className="mt-2 text-[13px] text-[#7FE7FF]">
                  {item.comment}
                </p>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminStat({ label, value, color }) {
  return (
    <div
      className="rounded-[22px] border p-4"
      style={{
        borderColor: `${color}35`,
        background: `${color}08`,
        boxShadow: `0 0 24px ${color}10`,
      }}
    >
      <p className="text-[12px] font-bold uppercase" style={{ color }}>
        {label}
      </p>

      <p className="mt-3 text-[20px] font-black" style={{ color }}>
        {value ?? "0"}
      </p>
    </div>
  );
}

function MiniBalance({ label, value, color }) {
  return (
    <div
      className="rounded-[14px] border p-2"
      style={{
        borderColor: `${color}25`,
        background: `${color}08`,
      }}
    >
      <p className="text-[10px] font-bold text-[#7E8DAA]">{label}</p>
      <p className="mt-1 text-[12px] font-black" style={{ color }}>
        {Number(value || 0).toFixed(2)}
      </p>
    </div>
  );
}

function AdminInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12px] font-bold text-[#7E8DAA]">{label}</p>

      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[16px] border border-[#00E5FF]/25 bg-[#050816] px-4 py-3 text-[14px] text-[#7FE7FF] outline-none"
      />
    </div>
  );
}

function AdminSelect({ label, value, onChange, options }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12px] font-bold text-[#7E8DAA]">{label}</p>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[16px] border border-[#00E5FF]/25 bg-[#050816] px-4 py-3 text-[14px] text-[#7FE7FF] outline-none"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AdminCard({ children, color }) {
  return (
    <div
      className="rounded-[22px] border bg-[#0B1220]/80 p-4"
      style={{
        borderColor: `${color}25`,
        boxShadow: `0 0 24px ${color}10`,
      }}
    >
      {children}
    </div>
  );
}