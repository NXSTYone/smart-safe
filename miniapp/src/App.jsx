import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import "swiper/css";

import {
  telegramAuth,
  getProfile,
  getPlans,
  getTransactions,
  getReferralDashboard,
  getSecretSafeInfo,
  activateSecretSafe,
  openSafe as apiOpenSafe,
  transferToMain,
  createWithdraw,
  getMyWithdrawals,
  cancelWithdraw,
  createDeposit,
  getMyDeposits,
} from "./api";

import {
  FaHeadset,
  FaTelegramPlane,
  FaHome,
  FaWallet,
  FaUsers,
  FaShieldAlt,
  FaKey,
  FaTimes,
  FaArrowDown,
  FaArrowUp,
  FaExchangeAlt,
  FaCopy,
} from "react-icons/fa";

import AdminPanel from "./pages/AdminPanel";

export default function App() {
  const [page, setPage] = useState("home");
  const [modal, setModal] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");

  const [balanceModal, setBalanceModal] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [depositNetwork, setDepositNetwork] = useState("TRC20");
  const [paymentDeposits, setPaymentDeposits] = useState([]);
  const [activeDepositPayment, setActiveDepositPayment] = useState(null);
  const [copiedDepositAddress, setCopiedDepositAddress] = useState(false);
  const [withdrawNetwork, setWithdrawNetwork] = useState("TRC20");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [copied, setCopied] = useState(false);
  const [lineModal, setLineModal] = useState(null);

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [referralDashboard, setReferralDashboard] = useState(null);
  const [secretSafe, setSecretSafe] = useState(null);
  const [secretModal, setSecretModal] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [secretSuccess, setSecretSuccess] = useState(null);
  const [loading, setLoading] = useState(true);

  const mainBalance = Number(profile?.balances?.main_balance || 0);
  const workBalance = Number(profile?.balances?.working_balance || 0);
  const referralBalance = Number(profile?.balances?.referral_balance || 0);

  const transferFee = 2;

  const nav = [
    { key: "home", icon: <FaHome />, title: "Главная", color: "#39FF14" },
    { key: "safes", icon: <FaShieldAlt />, title: "Сейфы", color: "#00E5FF" },
    { key: "balance", icon: <FaWallet />, title: "Баланс", color: "#7C3AED" },
    { key: "partners", icon: <FaUsers />, title: "Партнёры", color: "#00E5FF" },
    ...(user?.is_admin
      ? [
          {
            key: "admin",
            icon: <FaShieldAlt />,
            title: "Админ",
            color: "#F59E0B",
          },
        ]
      : []),
  ];

  const banners = [
    "/banners/banner-1.jpg",
    "/banners/banner-2.jpg",
    "/banners/banner-3.jpg",
  ];

  const safeVisuals = {
    basic: {
      color: "#39FF14",
      bg: "/backgrounds/basic-safe.png",
      icon: "/icons/basic-safe.png",
      fallbackBoost: "+0.1%",
    },
    standard: {
      color: "#00E5FF",
      bg: "/backgrounds/standard-safe.png",
      icon: "/icons/standard-safe.png",
      fallbackBoost: "+0.3%",
    },
    vip: {
      color: "#7C3AED",
      bg: "/backgrounds/vip-safe.png",
      icon: "/icons/vip-safe.png",
      fallbackBoost: "+0.5%",
    },
  };

  const fallbackSafes = [
    {
      key: "basic",
      name: "BASIC SAFE",
      percent: 10,
      percentText: "10%",
      min: 10,
      max: 2500,
      deposit: "10–2500 USDT",
      boost: "+0.1%",
      status: "Неактивен",
      active: false,
      color: "#39FF14",
      bg: "/backgrounds/basic-safe.png",
      icon: "/icons/basic-safe.png",
    },
    {
      key: "standard",
      name: "STANDARD SAFE",
      percent: 12.5,
      percentText: "12.5%",
      min: 250,
      max: 5000,
      deposit: "250–5000 USDT",
      boost: "+0.3%",
      status: "Неактивен",
      active: false,
      color: "#00E5FF",
      bg: "/backgrounds/standard-safe.png",
      icon: "/icons/standard-safe.png",
    },
    {
      key: "vip",
      name: "VIP SAFE",
      percent: 16.75,
      percentText: "16.75%",
      min: 500,
      max: 10000,
      deposit: "500–10000 USDT",
      boost: "+0.5%",
      status: "Неактивен",
      active: false,
      color: "#7C3AED",
      bg: "/backgrounds/vip-safe.png",
      icon: "/icons/vip-safe.png",
    },
  ];

  const safes =
    plans.length > 0
      ? plans.map((plan) => {
          const activeDeposit = profile?.deposits?.find(
            (deposit) => deposit.plan_code === plan.code && deposit.status === "active"
          );

          const visual = safeVisuals[plan.code] || safeVisuals.basic;
          const dailyPercent = Number(plan.daily_percent || 0);
          const minAmount = Number(plan.min_amount || 0);
          const maxAmount = Number(plan.max_amount || 0);
          const boostPercent = Number(plan.referral_boost_percent || 0);

          return {
            key: plan.code,
            name: plan.name,
            percent: dailyPercent,
            percentText: `${dailyPercent}%`.replace(".0%", "%"),
            min: minAmount,
            max: maxAmount,
            deposit: `${minAmount.toLocaleString("ru-RU")}–${maxAmount.toLocaleString("ru-RU")} USDT`,
            boost: `+${boostPercent}%`,
            status: activeDeposit ? "Активен" : "Неактивен",
            active: Boolean(activeDeposit),
            activeDeposit,
            color: visual.color,
            bg: visual.bg,
            icon: visual.icon,
          };
        })
      : fallbackSafes;

  const demoOperations = [
    {
      type: "income",
      title: "Начисление по VIP SAFE",
      amount: "+83.75 USDT",
      date: "Сегодня, 14:20",
      color: "#39FF14",
    },
    {
      type: "ref",
      title: "Партнёрское начисление",
      amount: "+25.00 USDT",
      date: "Сегодня, 11:05",
      color: "#00E5FF",
    },
    {
      type: "deposit",
      title: "Пополнение основного баланса",
      amount: "+500.00 USDT",
      date: "Вчера, 19:40",
      color: "#39FF14",
    },
    {
      type: "safe",
      title: "Открытие VIP SAFE",
      amount: "-500.00 USDT",
      date: "Вчера, 19:55",
      color: "#7C3AED",
    },
    {
      type: "withdraw",
      title: "Заявка на вывод",
      amount: "-150.00 USDT",
      date: "26.05.2026",
      color: "#F87171",
    },
  ];

  const operations =
    transactions.length > 0
      ? transactions.map((tx) => {
          const txAmount = Number(tx.amount || 0);
          const isMinus = ["open_safe", "withdraw", "withdraw_request", "transfer_fee"].includes(tx.type);
          const color =
            tx.type === "referral_reward"
              ? "#00E5FF"
              : tx.type === "open_safe"
              ? "#7C3AED"
              : tx.type === "withdraw" || tx.type === "withdraw_request"
              ? "#F87171"
              : "#39FF14";

          return {
            type: tx.type,
            title: tx.description || tx.type,
            amount: `${isMinus ? "-" : "+"}${Math.abs(txAmount).toFixed(2)} USDT`,
            date: tx.created_at
              ? new Date(tx.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
            color,
          };
        })
      : [];


  const partnerLink =
  referralDashboard?.referral_link ||
  `https://t.me/smart_safe_crypto_bot?startapp=${user?.referral_code || ""}`;
  const partnerStats = referralDashboard
    ? [
        {
          label: "Всего партнёров",
          value: referralDashboard.stats.total_partners,
          color: "#00E5FF",
        },
        {
          label: "Активных партнёров",
          value: referralDashboard.stats.active_partners,
          color: "#39FF14",
        },
        {
          label: "Оборот структуры",
          value: `${Number(referralDashboard.stats.structure_turnover || 0).toFixed(2)} USDT`,
          color: "#7C3AED",
        },
        {
          label: "Реферальный доход",
          value: `${Number(referralDashboard.stats.referral_income || 0).toFixed(2)} USDT`,
          color: "#39FF14",
        },
      ]
    : [
        {
          label: "Всего партнёров",
          value: "0",
          color: "#00E5FF",
        },
        {
          label: "Активных партнёров",
          value: "0",
          color: "#39FF14",
        },
        {
          label: "Оборот структуры",
          value: "0.00 USDT",
          color: "#7C3AED",
        },
        {
          label: "Реферальный доход",
          value: "0.00 USDT",
          color: "#39FF14",
        },
      ];

  const tariffBoosts =
    referralDashboard?.tariff_boosts?.map((item) => ({
      ...item,
      boost: `+${Number(item.boost || 0).toFixed(2)}%`,
    })) || [];

  const partnerLines = referralDashboard?.lines || [];

  const recentPartners = referralDashboard?.recent_partners || [];

  const openModal = (safe) => {
    setDepositAmount("");
    setModal(safe);
  };

  const openBalanceModal = (type) => {
    setBalanceAmount("");
    setDepositNetwork("TRC20");
    setActiveDepositPayment(null);
    setCopiedDepositAddress(false);
    setWithdrawNetwork("TRC20");
    setWithdrawAddress("");
    setBalanceModal(type);
  };

  const refreshUserData = async (authToken = token) => {
    if (!authToken) return;

    const profileResult = await getProfile(authToken);
    if (profileResult.success) {
      setProfile(profileResult);
    }

    const transactionsResult = await getTransactions(authToken);
    if (transactionsResult.success) {
      setTransactions(transactionsResult.transactions);
    }
  };

  const loadWithdrawals = async (authToken = token) => {
    if (!authToken) return;

    const result = await getMyWithdrawals(authToken);

    if (result.success) {
      setWithdrawals(result.withdrawals || []);
    }
  };

  const loadPaymentDeposits = async (authToken = token) => {
    if (!authToken) return;

    const result = await getMyDeposits(authToken);

    if (result.success) {
      setPaymentDeposits(result.deposits || []);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const tgWebApp = window.Telegram?.WebApp;
const tgUser = tgWebApp?.initDataUnsafe?.user;

const authResult = await telegramAuth({
  init_data: tgWebApp?.initData || "",
  telegram_id: tgUser?.id || "123456789",
  telegram_username: tgUser?.username || "roman",
  first_name: tgUser?.first_name || "Roman",
  last_name: tgUser?.last_name || "Smart",
  referral_code: tgWebApp?.initDataUnsafe?.start_param || "",
});

        if (!authResult.success) {
          console.error(authResult.message);
          return;
        }

        setToken(authResult.token);
        setUser(authResult.user);
        setProfile({
          user: authResult.user,
          balances: authResult.balances,
          deposits: [],
        });

        const plansResult = await getPlans();
        if (plansResult.success) {
          setPlans(plansResult.plans);
        }

        await refreshUserData(authResult.token);
        await loadWithdrawals(authResult.token);
        await loadPaymentDeposits(authResult.token);

        const referralResult = await getReferralDashboard(authResult.token);
        if (referralResult.success) {
          setReferralDashboard(referralResult);
        }

        const secretResult = await getSecretSafeInfo(authResult.token);
        if (secretResult.success) {
          setSecretSafe(secretResult.secret_safe);
        }
      } catch (error) {
        console.error("Init error:", error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleSecretActivate = async () => {
    if (!token || !secretCode.trim()) return;

    const result = await activateSecretSafe(token, secretCode.trim());

    if (!result.success) {
      alert(result.message || "Ошибка активации Secret Safe");
      return;
    }

    setSecretSuccess(result.amount);
    await refreshUserData(token);

    const secretInfo = await getSecretSafeInfo(token);
    if (secretInfo.success) {
      setSecretSafe(secretInfo.secret_safe);
    }

    setSecretModal(false);
    setSecretCode("");
  };

  const handleOpenSafe = async () => {
    if (!token || !modal || !amount || amountError) return;

    const result = await apiOpenSafe(token, modal.key, amount);

    if (!result.success) {
      alert(result.message || "Ошибка открытия сейфа");
      return;
    }

    await refreshUserData(token);
    setModal(null);
    setDepositAmount("");
  };

  const handleBalanceConfirm = async () => {
    if (!token || !balanceModal || !financeAmount || financeError) return;

    if (balanceModal.type === "deposit") {
      const result = await createDeposit(token, depositNetwork, financeAmount);

      if (!result.success) {
        alert(result.message || "Ошибка создания заявки на пополнение");
        return;
      }

      setActiveDepositPayment(result.deposit || result.payment || null);
      await loadPaymentDeposits(token);
      await refreshUserData(token);
      return;
    }

    if (balanceModal.type === "transferWork") {
      const result = await transferToMain(token, "working", financeAmount);

      if (!result.success) {
        alert(result.message || "Ошибка перевода");
        return;
      }

      await refreshUserData(token);
      setBalanceModal(null);
      setBalanceAmount("");
      return;
    }

    if (balanceModal.type === "transferReferral") {
      const result = await transferToMain(token, "referral", financeAmount);

      if (!result.success) {
        alert(result.message || "Ошибка перевода");
        return;
      }

      await refreshUserData(token);
      setBalanceModal(null);
      setBalanceAmount("");
      return;
    }

    if (balanceModal.type === "withdraw") {
      const result = await createWithdraw(
        token,
        withdrawNetwork,
        withdrawAddress.trim(),
        financeAmount
      );

      if (!result.success) {
        alert(result.message || "Ошибка создания заявки на вывод");
        return;
      }

      await refreshUserData(token);
      await loadWithdrawals(token);
      setBalanceModal(null);
      setBalanceAmount("");
      setWithdrawAddress("");
      setWithdrawNetwork("TRC20");
      return;
    }

    alert("Этот функционал подключим следующим шагом через backend.");
  };

  const copyPartnerLink = async () => {
    try {
      await navigator.clipboard.writeText(partnerLink);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch (error) {
      setCopied(false);
    }
  };


  const copyDepositAddress = async (address) => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopiedDepositAddress(true);

      setTimeout(() => {
        setCopiedDepositAddress(false);
      }, 1600);
    } catch (error) {
      setCopiedDepositAddress(false);
    }
  };

  const handleCancelWithdraw = async (withdrawalId) => {
    if (!token || !withdrawalId) return;

    const result = await cancelWithdraw(token, withdrawalId);

    if (!result.success) {
      alert(result.message || "Ошибка отмены заявки");
      return;
    }

    await refreshUserData(token);
    await loadWithdrawals(token);
  };

  const amount = Number(depositAmount);
  const dailyProfit = modal && amount > 0 ? (amount * modal.percent) / 100 : 0;
  const totalToX2 = amount > 0 ? amount * 2 : 0;
  const daysToX2 = dailyProfit > 0 ? Math.ceil(amount / dailyProfit) : 0;

  const amountError =
    modal && amount > 0 && (amount < modal.min || amount > modal.max)
      ? `Сумма должна быть от ${modal.min} до ${modal.max} USDT`
      : modal && amount > mainBalance
      ? "Недостаточно средств на основном балансе"
      : "";

  const financeAmount = Number(balanceAmount);

  const getModalBalance = () => {
    if (!balanceModal) return 0;
    if (balanceModal.type === "transferWork") return workBalance;
    if (balanceModal.type === "transferReferral") return referralBalance;
    if (balanceModal.type === "withdraw") return mainBalance;
    return mainBalance;
  };

  const currentFinanceBalance = getModalBalance();

  const commission =
    balanceModal?.type === "transferWork" && financeAmount > 0
      ? (financeAmount * transferFee) / 100
      : 0;

  const finalReceive = financeAmount > 0 ? financeAmount - commission : 0;

  const financeError =
    balanceModal &&
    balanceModal.type === "deposit" &&
    financeAmount > 0 &&
    financeAmount < 10
      ? "Минимальная сумма пополнения 10 USDT"
      : balanceModal &&
        balanceModal.type === "withdraw" &&
        financeAmount > 0 &&
        financeAmount < 10
      ? "Минимальная сумма вывода 10 USDT"
      : balanceModal &&
        financeAmount > currentFinanceBalance &&
        balanceModal.type !== "deposit"
      ? "Недостаточно средств"
      : balanceModal &&
        balanceModal.type === "withdraw" &&
        financeAmount > 0 &&
        (!withdrawAddress || withdrawAddress.trim().length < 10)
      ? "Укажите корректный адрес кошелька"
      : "";


  const getMemberDeposits = (member) => {
    if (Array.isArray(member.deposits)) return member.deposits;

    return [
      {
        safe: member.safe,
        deposit: member.deposit,
        color: member.color,
      },
    ];
  };

  const getDepositNumber = (deposit) => {
    const value = String(deposit || "0").replace(/[^0-9.]/g, "");
    return Number(value) || 0;
  };

  const getMemberTotalDeposit = (member) => {
    return getMemberDeposits(member).reduce(
      (total, item) => total + getDepositNumber(item.deposit),
      0
    );
  };

  const getWithdrawalStatus = (status) => {
    if (status === "pending") {
      return { label: "В ОБРАБОТКЕ", color: "#F59E0B" };
    }

    if (status === "completed") {
      return { label: "ВЫПОЛНЕНО", color: "#39FF14" };
    }

    if (status === "cancelled") {
      return { label: "ОТМЕНЕНО", color: "#7E8DAA" };
    }

    if (status === "rejected") {
      return { label: "ОТКЛОНЕНО", color: "#F87171" };
    }

    return { label: status || "НЕИЗВЕСТНО", color: "#00E5FF" };
  };


  const getDepositStatus = (status) => {
    if (status === "pending") {
      return { label: "ОЖИДАЕТ ОПЛАТУ", color: "#F59E0B" };
    }

    if (status === "completed" || status === "success") {
      return { label: "ПОПОЛНЕНО", color: "#39FF14" };
    }

    if (status === "cancelled") {
      return { label: "ОТМЕНЕНО", color: "#7E8DAA" };
    }

    if (status === "expired") {
      return { label: "ИСТЕКЛО", color: "#F87171" };
    }

    return { label: status || "НЕИЗВЕСТНО", color: "#00E5FF" };
  };

  const getDepositQr = (deposit) => {
    return (
      deposit?.provider_payload?.result?.QR ||
      deposit?.provider_payload?.result?.qr ||
      deposit?.payment?.qr ||
      deposit?.QR ||
      null
    );
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <p className="neon-title-purple text-[24px]">ЗАГРУЗКА SMART SAFE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white overflow-hidden relative">
      <div className="absolute inset-0">
        <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[160px]" />
        <div className="absolute top-[10%] right-[-200px] w-[450px] h-[450px] rounded-full bg-violet-600/10 blur-[160px]" />
        <div className="absolute bottom-[-200px] left-[20%] w-[400px] h-[400px] rounded-full bg-[#39FF14]/10 blur-[160px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-[520px] mx-auto pb-40">
        <header className="px-5 pt-6">
          <div className="flex items-start justify-between">
            <button
  onClick={() => {
    window.Telegram?.WebApp?.openTelegramLink("https://t.me/SmartSafe_Support");
  }}
  className="w-[64px] h-[64px] rounded-[24px] border border-[#39FF14]/25 bg-[#0B1220]/85 backdrop-blur-xl flex items-center justify-center shadow-[0_0_28px_rgba(57,255,20,.15)]"
>
  <FaHeadset className="text-[#39FF14] text-[24px]" />
</button>

            <div className="flex flex-col items-center justify-center text-center">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="relative mb-5"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#00E5FF]/20 to-[#A855F7]/30 blur-[40px] rounded-full" />

                <img
                  src="/logo/logo.png"
                  alt="SMART SAFE"
                  className="relative w-[160px] object-contain drop-shadow-[0_0_35px_rgba(124,58,237,.75)]"
                />
              </motion.div>

              <h1 className="neon-title text-[42px] leading-[1.05] tracking-[7px] text-center">
                SMART
                <br />
                SAFE
              </h1>

              <p className="neon-subtitle mt-4 text-[12px] tracking-[5px] text-center">
                СИСТЕМА ЦИФРОВЫХ СЕЙФОВ
              </p>
            </div>

            <button
  onClick={() => {
    window.Telegram?.WebApp?.openTelegramLink("https://t.me/+IpSstf5NRMk2OTIy");
  }}
  className="w-[64px] h-[64px] rounded-[24px] border border-[#00E5FF]/25 bg-[#0B1220]/85 backdrop-blur-xl flex items-center justify-center shadow-[0_0_28px_rgba(0,229,255,.15)]"
>
  <FaTelegramPlane className="text-[#00E5FF] text-[24px]" />
</button>
          </div>
        </header>

        {page === "home" && (
          <>
            <section className="px-5 mt-8">
              <Swiper
                modules={[Autoplay]}
                spaceBetween={16}
                slidesPerView={1}
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop
              >
                {banners.map((banner, index) => (
                  <SwiperSlide key={index}>
                    <div className="relative overflow-hidden rounded-[34px] border border-[#00E5FF]/10 h-[210px] shadow-[0_0_28px_rgba(0,229,255,.08)]">
                      <img
                        src={banner}
                        alt={`banner-${index}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/70 via-transparent to-transparent" />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </section>

            <section className="px-5 mt-7">
              <div className="relative overflow-hidden rounded-[36px] border border-[#00E5FF]/10 bg-[#0B1220]/80 backdrop-blur-2xl p-6">
                <div className="flex items-start justify-between gap-5">
                  <div className="flex-1">
                    <p className="neon-label text-[12px]">DIGITAL SAFE</p>

                    <h2 className="mt-4 text-[42px] leading-[1.08]">
                      <span className="neon-title-green block">БУДУЩЕЕ</span>
                      <span className="neon-title block mt-1">ЦИФРОВЫХ</span>
                      <span className="neon-title-purple block mt-1">
                        СЕЙФОВ
                      </span>
                    </h2>
                  </div>
                </div>

                <p className="mt-8 text-[17px] leading-relaxed neon-text">
                  Открывайте цифровые сейфы, получайте ежедневный доход и
                  усиливайте прибыль через партнёрскую систему.
                </p>

                <button
                  onClick={() => setPage("safes")}
                  className="group mt-8 relative w-full overflow-hidden rounded-[24px] border border-[#39FF14]/60 bg-[#111827] py-5 shadow-[0_0_28px_rgba(57,255,20,.28),inset_0_0_24px_rgba(57,255,20,.08)] transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/10 via-transparent to-[#00E5FF]/10 opacity-70" />

                  <div className="relative z-10 flex items-center justify-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-[#39FF14] shadow-[0_0_18px_rgba(57,255,20,.95)]" />

                    <span className="neon-button-text text-[17px] text-[#39FF14]">
                      ОТКРЫТЬ СЕЙФ
                    </span>
                  </div>
                </button>
              </div>
            </section>


            <section className="px-5 mt-7">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">
                  МОЯ СТАТИСТИКА
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PartnerStatCard
                  label="Открытых сейфов"
                  value={profile?.deposits?.length || 0}
                  color="#39FF14"
                />

                <PartnerStatCard
                  label="Активных сейфов"
                  value={
                    profile?.deposits?.filter(
                      (deposit) => deposit.status === "active"
                    ).length || 0
                  }
                  color="#00E5FF"
                />

                <PartnerStatCard
                  label="Всего инвестировано"
                  value={`${Number(
                    profile?.balances?.total_deposited || 0
                  ).toFixed(2)} USDT`}
                  color="#7C3AED"
                />

                <PartnerStatCard
                  label="Всего заработано"
                  value={`${Number(
                    profile?.balances?.total_earned || 0
                  ).toFixed(2)} USDT`}
                  color="#39FF14"
                />
              </div>
            </section>
            <section className="px-5 mt-7">
              <div
                className="relative overflow-hidden rounded-[32px] border border-[#7C3AED]/35 min-h-[430px] p-6 shadow-[0_0_36px_rgba(124,58,237,.25)]"
                style={{
                  backgroundImage: "url('/backgrounds/secret-bg.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                }}
              >
                <div className="absolute inset-0 bg-[#050816]/55" />
                <div className="absolute inset-0 bg-[#7C3AED]/10" />

                <div className="relative z-10 flex min-h-[382px] flex-col justify-end text-center">
                  <p className="neon-label-cyan text-[18px]">SECRET SAFE</p>

                  <h3
                    className="mt-3 text-[72px] leading-none"
                    style={{
                      fontFamily: "Orbitron",
                      fontWeight: 900,
                      color: "#8EEFFF",
                      WebkitTextStroke: "1px #00E5FF",
                      textShadow:
                        "0 0 6px rgba(0,229,255,.55), 0 0 14px rgba(0,229,255,.25), 0 0 24px rgba(124,58,237,.18)",
                    }}
                  >
                    {Number(secretSafe?.displayed_fund || 0).toLocaleString("ru-RU")}
                  </h3>

                  <p
                    className="mt-3 text-[22px] font-bold tracking-[2px] text-[#7FE7FF]"
                    style={{ textShadow: "0 0 12px rgba(0,229,255,.22)" }}
                  >
                    ФОНД СЕЙФА
                  </p>

                  <p className="mx-auto mt-6 max-w-[320px] text-[22px] font-semibold leading-relaxed text-[#7FE7FF]">
                    Чтобы открыть Secret Safe — введите уникальный код доступа.
                  </p>

                  <button
                    onClick={() => {
                      setSecretCode("");
                      setSecretSuccess(null);
                      setSecretModal(true);
                    }}
                    className="group mx-auto mt-7 relative w-full max-w-[310px] overflow-hidden rounded-[22px] border border-[#A855F7]/55 bg-[#160B26]/95 py-5 shadow-[0_0_42px_rgba(168,85,247,.45),inset_0_0_28px_rgba(124,58,237,.16)] transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/18 via-[#A855F7]/10 to-[#00E5FF]/12 opacity-80" />

                    <span className="relative z-10 flex items-center justify-center gap-3 neon-button-purple text-[15px]">
                      <FaKey className="text-[14px]" />
                      АКТИВИРОВАТЬ КОД
                    </span>
                  </button>
                </div>
              </div>
            </section>

            
          </>
        )}

        {page === "safes" && (
          <section className="px-5 mt-8">
            <div className="mb-7">
              <p className="neon-label text-[13px]">SMART SAFE</p>

              <h2 className="mt-3 neon-title-purple text-[40px] leading-[1.05]">
                ЦИФРОВЫЕ
                <br />
                СЕЙФЫ
              </h2>

              <p className="mt-5 text-[17px] leading-relaxed neon-text">
                Выберите сейф, откройте депозит с основного баланса и получайте
                ежедневные начисления до достижения X2.
              </p>
            </div>

            <div className="space-y-6">
              {safes.map((safe) => (
                <div
                  key={safe.key}
                  className="relative overflow-hidden rounded-[34px] border min-h-[390px] p-5 shadow-[0_0_34px_rgba(0,229,255,.08)]"
                  style={{
                    borderColor: `${safe.color}55`,
                    backgroundImage: `url('${safe.bg}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-[#050816]/72" />

                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, rgba(5,8,22,.25), rgba(5,8,22,.95)), linear-gradient(90deg, rgba(5,8,22,.95), ${safe.color}22)`,
                    }}
                  />

                  <div
                    className="absolute right-[-70px] top-[-70px] h-[220px] w-[220px] rounded-full blur-[100px]"
                    style={{ background: `${safe.color}28` }}
                  />

                  <div className="relative z-10 flex min-h-[350px] flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p
                            className="text-[14px] font-black tracking-[3px]"
                            style={{
                              color: safe.color,
                              textShadow: `0 0 14px ${safe.color}88`,
                            }}
                          >
                            {safe.status.toUpperCase()}
                          </p>

                          <h3
                            className="mt-3 text-[30px] font-black"
                            style={{
                              color: safe.color,
                              textShadow: `0 0 20px ${safe.color}66`,
                            }}
                          >
                            {safe.name}
                          </h3>

                          <p
                            className="mt-2 text-[16px] font-semibold"
                            style={{
                              color: safe.color,
                              textShadow: `0 0 10px ${safe.color}55`,
                            }}
                          >
                            Работает до достижения X2
                          </p>
                        </div>

                        <motion.div
                          animate={{ y: [0, -6, 0] }}
                          transition={{ repeat: Infinity, duration: 4 }}
                          className="relative"
                        >
                          <div
                            className="absolute inset-0 rounded-[26px] blur-[28px]"
                            style={{ background: `${safe.color}30` }}
                          />

                          <div
                            className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border bg-[#081120]/80"
                            style={{
                              borderColor: `${safe.color}60`,
                              boxShadow: `0 0 30px ${safe.color}35`,
                            }}
                          >
                            <img
                              src={safe.icon}
                              alt={safe.name}
                              className="h-[100px] w-[100px] object-contain"
                              style={{
                                filter: `drop-shadow(0 0 14px ${safe.color})`,
                              }}
                            />
                          </div>
                        </motion.div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <Info
                          label="Доходность"
                          value={`${safe.percentText} / день`}
                          color={safe.color}
                        />
                        <Info label="Лимит" value="X2" color={safe.color} />
                        <Info
                          label="Депозит"
                          value={safe.deposit}
                          color={safe.color}
                        />
                        <Info
                          label="Усиление"
                          value={`${safe.boost} за партнёра`}
                          color={safe.color}
                        />
                      </div>

                      <p
                        className="mt-5 text-[15px] font-semibold leading-relaxed"
                        style={{
                          color: safe.color,
                          textShadow: `0 0 10px ${safe.color}44`,
                        }}
                      >
                        Досрочного закрытия нет. Если последнее начисление
                        превысит X2, оно начисляется полностью, и только после
                        этого сейф закрывается.
                      </p>
                    </div>

                    <button
                      onClick={() => openModal(safe)}
                      className="mt-6 w-full rounded-[22px] border py-5 font-black tracking-[1px]"
                      style={{
                        borderColor: `${safe.color}90`,
                        color: safe.color,
                        background: `${safe.color}14`,
                        boxShadow: `0 0 34px ${safe.color}35, inset 0 0 24px ${safe.color}14`,
                        textShadow: `0 0 12px ${safe.color}88`,
                      }}
                    >
                      {safe.active ? "ПОДРОБНЕЕ" : "ОТКРЫТЬ"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {page === "balance" && (
          <section className="px-5 mt-8">
            <div className="mb-7">
              <p className="neon-label text-[13px]">SMART SAFE</p>

              <h2 className="mt-3 neon-title-purple text-[40px] leading-[1.05]">
                БАЛАНСЫ
                <br />
                СИСТЕМЫ
              </h2>

              <p className="mt-5 text-[17px] leading-relaxed neon-text">
                Управляйте основным, рабочим и реферальным балансом. Все
                операции отображаются в истории.
              </p>
            </div>

            <div className="space-y-5">
              <BalanceCard
                title="Основной баланс"
                value={mainBalance}
                color="#39FF14"
                bg="/backgrounds/main-balance.png"
                description="Используется для открытия сейфов, пополнений и вывода средств."
                actions={[
                  {
                    label: "ПОПОЛНИТЬ",
                    icon: <FaArrowDown />,
                    onClick: () =>
                      openBalanceModal({
                        type: "deposit",
                        title: "Пополнение",
                        color: "#39FF14",
                      }),
                  },
                  {
                    label: "ВЫВЕСТИ",
                    icon: <FaArrowUp />,
                    onClick: () =>
                      openBalanceModal({
                        type: "withdraw",
                        title: "Вывод средств",
                        color: "#39FF14",
                      }),
                  },
                ]}
              />

              <BalanceCard
                title="Рабочий баланс"
                value={workBalance}
                color="#00E5FF"
                bg="/backgrounds/work-balance.png"
                description={`Сюда поступают ежедневные начисления по сейфам. Перевод на основной баланс с комиссией ${transferFee}%.`}
                actions={[
                  {
                    label: "ПЕРЕВЕСТИ",
                    icon: <FaExchangeAlt />,
                    onClick: () =>
                      openBalanceModal({
                        type: "transferWork",
                        title: "Перевод с рабочего баланса",
                        color: "#00E5FF",
                      }),
                  },
                ]}
              />

              <BalanceCard
                title="Реферальный баланс"
                value={referralBalance}
                color="#7C3AED"
                bg="/backgrounds/ref-balance.png"
                description="Сюда поступают партнёрские начисления, бонусы структуры и реферальные вознаграждения."
                actions={[
                  {
                    label: "ПЕРЕВЕСТИ",
                    icon: <FaExchangeAlt />,
                    onClick: () =>
                      openBalanceModal({
                        type: "transferReferral",
                        title: "Перевод с реферального баланса",
                        color: "#7C3AED",
                      }),
                  },
                ]}
              />
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">ИСТОРИЯ ОПЕРАЦИЙ</p>
              </div>

              <div className="space-y-3">
                {operations.map((op, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border bg-[#0B1220]/80 p-4"
                    style={{
                      borderColor: `${op.color}22`,
                      boxShadow: `0 0 24px ${op.color}10`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p
                          className="text-[15px] font-bold"
                          style={{ color: op.color }}
                        >
                          {op.title}
                        </p>

                        <p className="mt-1 text-[13px] text-[#7E8DAA]">
                          {op.date}
                        </p>
                      </div>

                      <p
                        className="text-[16px] font-black"
                        style={{
                          color: op.color,
                          textShadow: `0 0 10px ${op.color}55`,
                        }}
                      >
                        {op.amount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">ЗАЯВКИ НА ПОПОЛНЕНИЕ</p>

                <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
                  Здесь отображаются созданные адреса для пополнения. Отправляйте USDT только в выбранной сети.
                </p>
              </div>

              <div className="space-y-3">
                {paymentDeposits.length === 0 && (
                  <div className="rounded-[24px] border border-[#00E5FF]/20 bg-[#0B1220]/80 p-4">
                    <p className="text-[14px] font-semibold text-[#7E8DAA]">
                      У вас пока нет заявок на пополнение.
                    </p>
                  </div>
                )}

                {paymentDeposits.map((deposit) => {
                  const statusInfo = getDepositStatus(deposit.status);

                  return (
                    <div
                      key={deposit.id}
                      className="rounded-[24px] border bg-[#0B1220]/80 p-4"
                      style={{
                        borderColor: `${statusInfo.color}30`,
                        boxShadow: `0 0 24px ${statusInfo.color}12`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p
                            className="text-[16px] font-black"
                            style={{
                              color: statusInfo.color,
                              textShadow: `0 0 12px ${statusInfo.color}55`,
                            }}
                          >
                            {deposit.network} · {deposit.currency || "USDT"}
                          </p>

                          <p className="mt-1 text-[13px] text-[#7E8DAA]">
                            Создана:{" "}
                            {deposit.created_at
                              ? new Date(deposit.created_at).toLocaleString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>

                          <p className="mt-2 break-all text-[13px] font-semibold text-[#7FE7FF]">
                            {deposit.address}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className="text-[18px] font-black"
                            style={{ color: statusInfo.color }}
                          >
                            {Number(deposit.amount || 0).toFixed(2)} USDT
                          </p>

                          <p
                            className="mt-2 text-[12px] font-black"
                            style={{ color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </p>
                        </div>
                      </div>

                      {deposit.tx_hash && (
                        <div className="mt-4 rounded-[16px] border border-[#39FF14]/20 bg-[#39FF14]/5 p-3">
                          <p className="text-[12px] font-bold text-[#39FF14]">
                            TX HASH
                          </p>
                          <p className="mt-1 break-all text-[12px] text-[#7FE7FF]">
                            {deposit.tx_hash}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">ЗАЯВКИ НА ВЫВОД</p>

                <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
                  Здесь отображаются ваши заявки на вывод средств. Заявку в обработке можно отменить до выплаты.
                </p>
              </div>

              <div className="space-y-3">
                {withdrawals.length === 0 && (
                  <div className="rounded-[24px] border border-[#00E5FF]/20 bg-[#0B1220]/80 p-4">
                    <p className="text-[14px] font-semibold text-[#7E8DAA]">
                      У вас пока нет заявок на вывод.
                    </p>
                  </div>
                )}

                {withdrawals.map((withdrawal) => {
                  const statusInfo = getWithdrawalStatus(withdrawal.status);

                  return (
                    <div
                      key={withdrawal.id}
                      className="rounded-[24px] border bg-[#0B1220]/80 p-4"
                      style={{
                        borderColor: `${statusInfo.color}30`,
                        boxShadow: `0 0 24px ${statusInfo.color}12`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p
                            className="text-[16px] font-black"
                            style={{
                              color: statusInfo.color,
                              textShadow: `0 0 12px ${statusInfo.color}55`,
                            }}
                          >
                            {withdrawal.network}
                          </p>

                          <p className="mt-1 text-[13px] text-[#7E8DAA]">
                            Создана:{" "}
                            {withdrawal.created_at
                              ? new Date(withdrawal.created_at).toLocaleString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>

                          <p className="mt-2 break-all text-[13px] font-semibold text-[#7FE7FF]">
                            {withdrawal.wallet_address}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className="text-[18px] font-black"
                            style={{ color: statusInfo.color }}
                          >
                            {Number(withdrawal.final_amount || withdrawal.amount || 0).toFixed(2)} USDT
                          </p>

                          <p
                            className="mt-2 text-[12px] font-black"
                            style={{ color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </p>
                        </div>
                      </div>

                      {withdrawal.tx_hash && (
                        <div className="mt-4 rounded-[16px] border border-[#39FF14]/20 bg-[#39FF14]/5 p-3">
                          <p className="text-[12px] font-bold text-[#39FF14]">
                            TX HASH
                          </p>
                          <p className="mt-1 break-all text-[12px] text-[#7FE7FF]">
                            {withdrawal.tx_hash}
                          </p>
                        </div>
                      )}

                      {withdrawal.admin_comment && (
                        <p className="mt-3 text-[13px] text-[#7E8DAA]">
                          Комментарий: {withdrawal.admin_comment}
                        </p>
                      )}

                      {withdrawal.status === "pending" && (
                        <button
                          onClick={() => handleCancelWithdraw(withdrawal.id)}
                          className="mt-4 w-full rounded-[18px] border border-[#F59E0B]/65 bg-[#F59E0B]/10 py-3 font-black text-[#F59E0B]"
                          style={{
                            boxShadow: "0 0 24px rgba(245,158,11,.18), inset 0 0 16px rgba(245,158,11,.08)",
                            textShadow: "0 0 10px rgba(245,158,11,.6)",
                          }}
                        >
                          ОТМЕНИТЬ ЗАЯВКУ
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {page === "partners" && (
          <section className="px-5 mt-8">
            <div className="mb-7">
              <p className="neon-label text-[13px]">SMART SAFE</p>

              <h2 className="mt-3 neon-title-purple text-[40px] leading-[1.05]">
                ПАРТНЁРСКАЯ
                <br />
                СИСТЕМА
              </h2>

              <p className="mt-5 text-[17px] leading-relaxed neon-text">
                Приглашайте партнёров, увеличивайте структуру и усиливайте
                доходность своих сейфов за счёт активных участников.
              </p>
            </div>

            <div
              className="relative overflow-hidden rounded-[32px] border p-5"
              style={{
                borderColor: "rgba(0,229,255,.28)",
                backgroundImage: "url('/backgrounds/partners-bg.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 0 34px rgba(0,229,255,.12)",
              }}
            >
              <div className="absolute inset-0 bg-[#050816]/78" />

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(5,8,22,.25), rgba(5,8,22,.95)), linear-gradient(90deg, rgba(5,8,22,.92), rgba(0,229,255,.14), rgba(124,58,237,.18))",
                }}
              />

              <div className="absolute right-[-80px] top-[-80px] h-[230px] w-[230px] rounded-full bg-[#00E5FF]/20 blur-[110px]" />

              <div className="relative z-10">
                <p className="neon-label-cyan text-[14px]">
                  МОЯ ПАРТНЁРСКАЯ ССЫЛКА
                </p>

                <div className="mt-4 rounded-[22px] border border-[#00E5FF]/20 bg-[#050816]/70 p-4">
                  <p className="break-all text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
                    {partnerLink}
                  </p>
                </div>

                <button
                  onClick={copyPartnerLink}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-[22px] border border-[#00E5FF]/55 bg-[#00E5FF]/10 py-5 font-black text-[#00E5FF] shadow-[0_0_28px_rgba(0,229,255,.22),inset_0_0_18px_rgba(0,229,255,.10)]"
                  style={{
                    textShadow: "0 0 12px rgba(0,229,255,.65)",
                  }}
                >
                  <FaCopy />
                  {copied ? "ССЫЛКА СКОПИРОВАНА" : "КОПИРОВАТЬ ССЫЛКУ"}
                </button>
                <div className="mt-5 rounded-[22px] border border-[#7C3AED]/35 bg-[#7C3AED]/10 p-4">
  <p className="text-[13px] font-black text-[#B66CFF]">
    ВАШ ПРИГЛАСИТЕЛЬ
  </p>
  <p className="mt-2 text-[15px] font-black text-[#B66CFF]">
    {referralDashboard?.inviter
      ? referralDashboard.inviter.display_name
      : "Вы зарегистрированы без пригласителя"}
  </p>
  {referralDashboard?.inviter?.referral_code && (
    <p className="mt-1 text-[12px] font-bold text-[#B66CFF]">
      Код: {referralDashboard.inviter.referral_code}
    </p>
  )}
</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {partnerStats.map((stat, index) => (
                <PartnerStatCard
                  key={index}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                />
              ))}
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">
                  УСИЛЕНИЕ ДОХОДНОСТИ
                </p>

                <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
                  Каждый активный партнёр с аналогичным тарифом увеличивает
                  доходность вашего открытого сейфа.
                </p>
              </div>

              <div className="space-y-4">
                {tariffBoosts.map((item, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-[26px] border bg-[#0B1220]/85 p-4"
                    style={{
                      borderColor: `${item.color}35`,
                      boxShadow: `0 0 26px ${item.color}12`,
                    }}
                  >
                    <div
                      className="absolute right-[-60px] top-[-60px] h-[160px] w-[160px] rounded-full blur-[80px]"
                      style={{ background: `${item.color}20` }}
                    />

                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div>
                        <p
                          className="text-[18px] font-black"
                          style={{
                            color: item.color,
                            textShadow: `0 0 14px ${item.color}66`,
                          }}
                        >
                          {item.name}
                        </p>

                        <p className="mt-1 text-[13px] font-semibold text-[#7FE7FF]">
  Активных партнёров: {item.active_partners}
</p>

<p className="mt-1 text-[12px] text-[#7E8DAA]">
  {item.note}
</p>
                      </div>

                      <p
                        className="text-[30px] font-black"
                        style={{
                          color: item.color,
                          textShadow: `0 0 18px ${item.color}66`,
                        }}
                      >
                        {item.boost}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">
                  СТРУКТУРА ПО ЛИНИЯМ
                </p>
              </div>

              <div className="space-y-3">
                {partnerLines.map((line, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border bg-[#0B1220]/80 p-4"
                    style={{
                      borderColor: `${line.color}30`,
                      boxShadow: `0 0 24px ${line.color}10`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p
                          className="text-[16px] font-black uppercase"
                          style={{
                            color: line.color,
                            textShadow: `0 0 12px ${line.color}55`,
                          }}
                        >
                          {line.line}
                        </p>

                        <p className="mt-1 text-[13px] text-[#7E8DAA]">
                          {line.partners}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-[16px] font-black"
                          style={{ color: line.color }}
                        >
                          {line.turnover}
                        </p>

                        <p className="mt-1 text-[12px] text-[#7E8DAA]">
                          оборот
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setLineModal(line)}
                      className="mt-4 w-full rounded-[18px] border py-3 font-black"
                      style={{
                        borderColor: `${line.color}60`,
                        color: line.color,
                        background: `${line.color}10`,
                        boxShadow: `0 0 22px ${line.color}18, inset 0 0 14px ${line.color}08`,
                        textShadow: `0 0 10px ${line.color}55`,
                      }}
                    >
                      ПОДРОБНЕЕ
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-4">
                <p className="neon-label-cyan text-[14px]">
                  ПОСЛЕДНИЕ ПАРТНЁРЫ
                </p>
              </div>

              <div className="space-y-3">
                {recentPartners.map((partner, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border bg-[#0B1220]/80 p-4"
                    style={{
                      borderColor: `${partner.color}30`,
                      boxShadow: `0 0 24px ${partner.color}10`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p
                          className="text-[16px] font-black"
                          style={{ color: partner.color }}
                        >
                          {partner.user}
                        </p>

                        <p className="mt-1 text-[13px] text-[#7E8DAA]">
                          {partner.safe} · {partner.status}
                        </p>
                      </div>

                      <p
                        className="text-[16px] font-black"
                        style={{
                          color: partner.color,
                          textShadow: `0 0 10px ${partner.color}55`,
                        }}
                      >
                        {partner.deposit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {page === "admin" && user?.is_admin && (
          <AdminPanel token={token} />
        )}

      </div>

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div
            className="relative w-full max-w-[430px] rounded-[30px] border bg-[#0B1220] p-6 shadow-[0_0_55px_rgba(0,229,255,.14)]"
            style={{ borderColor: `${modal.color}55` }}
          >
            <button
              onClick={() => setModal(null)}
              className="absolute right-5 top-5 text-[#7FE7FF]"
            >
              <FaTimes />
            </button>

            <h3
              className="text-[30px] font-black"
              style={{
                color: modal.color,
                textShadow: `0 0 18px ${modal.color}55`,
              }}
            >
              {modal.name}
            </h3>
            <div
  className="mt-5 rounded-[20px] border p-4 text-center"
  style={{
    borderColor: `${modal.color}40`,
    background: `${modal.color}08`,
  }}
>
  <p
    className="text-[12px] font-bold tracking-[2px]"
    style={{
      color: modal.color,
      opacity: 0.8,
    }}
  >
    СТАТУС СЕЙФА
  </p>

  <p
    className="mt-2 text-[24px] font-black"
    style={{
      color: modal.active ? "#39FF14" : "#F87171",
      textShadow: modal.active
        ? "0 0 16px rgba(57,255,20,.7)"
        : "0 0 16px rgba(248,113,113,.7)",
    }}
  >
    {modal.active ? "АКТИВЕН" : "НЕ АКТИВЕН"}
  </p>
</div>

            {!modal.active ? (
              <>
                <div
                  className="mt-5 rounded-[20px] border p-4"
                  style={{
                    borderColor: `${modal.color}35`,
                    background: `${modal.color}08`,
                  }}
                >
                  <p className="text-[13px]" style={{ color: modal.color }}>
                    ДОСТУПНЫЙ ОСНОВНОЙ БАЛАНС
                  </p>

                  <p
                    className="mt-1 text-[28px] font-black"
                    style={{ color: modal.color }}
                  >
                    {mainBalance.toLocaleString("ru-RU")} USDT
                  </p>
                </div>

                <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
                  Депозит можно открыть только с основного баланса.
                </p>

                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  type="number"
                  placeholder={`Введите сумму от ${modal.min} до ${modal.max} USDT`}
                  className="mt-5 w-full rounded-[18px] border bg-[#050816] px-4 py-4 text-[#7FE7FF] outline-none"
                  style={{
                    borderColor: `${modal.color}45`,
                  }}
                />

                {amountError && (
                  <p className="mt-3 text-[14px] text-red-400">
                    {amountError}
                  </p>
                )}

                {amount > 0 && !amountError && (
                  <div
                    className="mt-5 rounded-[22px] border p-4"
                    style={{
                      borderColor: `${modal.color}35`,
                      background: `${modal.color}08`,
                    }}
                  >
                    <p
                      className="text-[13px] font-bold"
                      style={{ color: modal.color }}
                    >
                      КАЛЬКУЛЯТОР ДОХОДНОСТИ
                    </p>

                    <div className="mt-4 space-y-3 text-[15px] text-[#9DDFF0]">
                      <p>
                        Сумма депозита: {amount.toLocaleString("ru-RU")} USDT
                      </p>
                      <p>Доходность: {modal.percentText} в день</p>
                      <p>Начисление в день: {dailyProfit.toFixed(2)} USDT</p>
                      <p>Итог до X2: {totalToX2.toFixed(2)} USDT</p>
                      <p>Примерный срок до X2: {daysToX2} дней</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleOpenSafe}
                  disabled={!!amountError || !amount}
                  className="mt-5 w-full rounded-[20px] py-4 font-bold disabled:opacity-40"
                  style={{
                    background: `${modal.color}22`,
                    color: modal.color,
                    border: `1px solid ${modal.color}80`,
                    boxShadow: `0 0 30px ${modal.color}25`,
                  }}
                >
                  ОТКРЫТЬ СЕЙФ
                </button>
              </>
            ) : (
              <>
                <div className="mt-5 space-y-3 text-[15px] text-[#9DDFF0]">
                  <p>
                    Дата открытия:{" "}
                    {modal.activeDeposit?.opened_at
                      ? new Date(modal.activeDeposit.opened_at).toLocaleString("ru-RU")
                      : "—"}
                  </p>
                  <p>
                    Сумма депозита: {Number(modal.activeDeposit?.amount || 0).toFixed(2)} USDT
                  </p>
                  <p>Базовый процент: {modal.percentText}</p>
                  <p>
                    Текущий процент: {Number(modal.activeDeposit?.total_percent || modal.percent).toFixed(2)}%
                  </p>
                  <p>
                    Усиление от партнёров: +{Number(modal.activeDeposit?.boost_percent || 0).toFixed(2)}%
                  </p>
                  <p>
                    Начислено: {Number(modal.activeDeposit?.earned_amount || 0).toFixed(2)} USDT
                  </p>
                  <p>
                    Осталось до X2:{" "}
                    {Math.max(
                      Number(modal.activeDeposit?.max_return_amount || 0) -
                        Number(modal.activeDeposit?.earned_amount || 0),
                      0
                    ).toFixed(2)}{" "}
                    USDT
                  </p>
                </div>

                <div className="mt-5 h-[10px] overflow-hidden rounded-full bg-[#050816]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        (Number(modal.activeDeposit?.earned_amount || 0) /
                          Number(modal.activeDeposit?.max_return_amount || 1)) *
                          100,
                        100
                      )}%`,
                      background: modal.color,
                      boxShadow: `0 0 18px ${modal.color}`,
                    }}
                  />
                </div>

                <p className="mt-3 text-[13px] text-[#7FE7FF]">
                  Прогресс до завершения:{" "}
                  {Math.min(
                    (Number(modal.activeDeposit?.earned_amount || 0) /
                      Number(modal.activeDeposit?.max_return_amount || 1)) *
                      100,
                    100
                  ).toFixed(0)}%
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {secretModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div className="relative w-full max-w-[430px] rounded-[30px] border border-[#A855F7]/55 bg-[#0B1220] p-6 shadow-[0_0_55px_rgba(168,85,247,.22)]">
            <button
              onClick={() => setSecretModal(false)}
              className="absolute right-5 top-5 text-[#7FE7FF]"
            >
              <FaTimes />
            </button>

            <p className="neon-label-cyan text-[14px]">SECRET SAFE</p>

            <h3
              className="mt-3 text-[30px] font-black"
              style={{
                color: "#A855F7",
                textShadow: "0 0 18px rgba(168,85,247,.65)",
              }}
            >
              АКТИВАЦИЯ КОДА
            </h3>

            <div className="mt-5 rounded-[22px] border border-[#A855F7]/35 bg-[#A855F7]/10 p-4 text-center">
              <p className="text-[13px] font-bold tracking-[2px] text-[#A855F7]">
                ТЕКУЩИЙ ФОНД
              </p>

              <p
                className="mt-2 text-[34px] font-black"
                style={{
                  color: "#8EEFFF",
                  textShadow: "0 0 18px rgba(0,229,255,.45)",
                }}
              >
                {Number(secretSafe?.displayed_fund || 0).toLocaleString("ru-RU")} USDT
              </p>
            </div>

            <p className="mt-5 text-[16px] font-semibold leading-relaxed text-[#7FE7FF]">
              Введите уникальный код доступа. После успешной активации бонус будет зачислен на основной баланс.
            </p>

            <input
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              type="text"
              placeholder="Введите Secret Safe код"
              className="mt-5 w-full rounded-[18px] border border-[#A855F7]/45 bg-[#050816] px-4 py-4 text-center text-[18px] font-black tracking-[2px] text-[#7FE7FF] outline-none"
            />

            <button
              onClick={handleSecretActivate}
              disabled={!secretCode.trim()}
              className="mt-5 w-full rounded-[20px] border border-[#A855F7]/70 bg-[#A855F7]/15 py-5 font-black text-[#A855F7] disabled:opacity-40"
              style={{
                boxShadow: "0 0 34px rgba(168,85,247,.24), inset 0 0 22px rgba(168,85,247,.10)",
                textShadow: "0 0 12px rgba(168,85,247,.75)",
              }}
            >
              АКТИВИРОВАТЬ SECRET SAFE
            </button>
          </div>
        </div>
      )}

      {secretSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div className="relative w-full max-w-[430px] rounded-[30px] border border-[#39FF14]/55 bg-[#0B1220] p-6 text-center shadow-[0_0_55px_rgba(57,255,20,.18)]">
            <button
              onClick={() => setSecretSuccess(null)}
              className="absolute right-5 top-5 text-[#7FE7FF]"
            >
              <FaTimes />
            </button>

            <p className="neon-label-cyan text-[14px]">SECRET SAFE</p>

            <h3
              className="mt-4 text-[30px] font-black"
              style={{
                color: "#39FF14",
                textShadow: "0 0 18px rgba(57,255,20,.65)",
              }}
            >
              СЕЙФ ОТКРЫТ
            </h3>

            <p
              className="mt-6 text-[44px] font-black"
              style={{
                color: "#39FF14",
                textShadow: "0 0 22px rgba(57,255,20,.6)",
              }}
            >
              +{Number(secretSuccess || 0).toFixed(2)} USDT
            </p>

            <p className="mx-auto mt-5 max-w-[300px] text-[17px] font-semibold leading-relaxed text-[#7FE7FF]">
              Бонус начислен на основной баланс и добавлен в историю операций.
            </p>

            <button
              onClick={() => setSecretSuccess(null)}
              className="mt-7 w-full rounded-[20px] border border-[#39FF14]/70 bg-[#39FF14]/15 py-5 font-black text-[#39FF14]"
              style={{
                boxShadow: "0 0 34px rgba(57,255,20,.22), inset 0 0 22px rgba(57,255,20,.10)",
                textShadow: "0 0 12px rgba(57,255,20,.75)",
              }}
            >
              ОТЛИЧНО
            </button>
          </div>
        </div>
      )}

      {balanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div
            className="relative w-full max-w-[430px] rounded-[30px] border bg-[#0B1220] p-6 shadow-[0_0_55px_rgba(0,229,255,.14)]"
            style={{ borderColor: `${balanceModal.color}55` }}
          >
            <button
              onClick={() => setBalanceModal(null)}
              className="absolute right-5 top-5 text-[#7FE7FF]"
            >
              <FaTimes />
            </button>

            <h3
              className="text-[28px] font-black"
              style={{
                color: balanceModal.color,
                textShadow: `0 0 18px ${balanceModal.color}55`,
              }}
            >
              {balanceModal.title}
            </h3>

            {balanceModal.type !== "deposit" && (
              <div
                className="mt-5 rounded-[20px] border p-4"
                style={{
                  borderColor: `${balanceModal.color}35`,
                  background: `${balanceModal.color}08`,
                }}
              >
                <p
                  className="text-[13px]"
                  style={{ color: balanceModal.color }}
                >
                  ДОСТУПНО
                </p>

                <p
                  className="mt-1 text-[28px] font-black"
                  style={{ color: balanceModal.color }}
                >
                  {currentFinanceBalance.toLocaleString("ru-RU")} USDT
                </p>
              </div>
            )}

            {balanceModal.type === "deposit" && (
              <>
                <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
                  Выберите сеть и сумму. После создания заявки система покажет
                  адрес и QR-код для оплаты.
                </p>

                <div className="mt-5">
                  <p className="mb-3 text-[15px] font-bold text-[#7E8DAA]">
                    СЕТЬ ПОПОЛНЕНИЯ USDT
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {["TRC20", "BEP20"].map((network) => (
                      <button
                        key={network}
                        onClick={() => {
                          setDepositNetwork(network);
                          setActiveDepositPayment(null);
                        }}
                        className="rounded-[18px] border py-4 font-black"
                        style={{
                          borderColor:
                            depositNetwork === network
                              ? `${balanceModal.color}90`
                              : `${balanceModal.color}25`,
                          color:
                            depositNetwork === network
                              ? balanceModal.color
                              : "#7E8DAA",
                          background:
                            depositNetwork === network
                              ? `${balanceModal.color}18`
                              : "#050816",
                          boxShadow:
                            depositNetwork === network
                              ? `0 0 24px ${balanceModal.color}25`
                              : "none",
                        }}
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {balanceModal.type === "withdraw" && (
              <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
                Вывод создаётся с основного баланса. После отправки заявка
                появится в обработке.
              </p>
            )}

            {balanceModal.type === "transferWork" && (
              <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
                Перевод с рабочего баланса на основной баланс. Комиссия
                перевода: {transferFee}%.
              </p>
            )}

            {balanceModal.type === "transferReferral" && (
              <p className="mt-5 text-[16px] leading-relaxed text-[#7FE7FF]">
                Перевод реферального баланса на основной баланс. Средства можно
                использовать для открытия сейфов.
              </p>
            )}

            {balanceModal.type === "withdraw" && (
              <div className="mt-5">
                <p className="mb-3 text-[15px] font-bold text-[#7E8DAA]">
                  СЕТЬ ВЫВОДА USDT
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {["TRC20", "BEP20"].map((network) => (
                    <button
                      key={network}
                      onClick={() => setWithdrawNetwork(network)}
                      className="rounded-[18px] border py-4 font-black"
                      style={{
                        borderColor:
                          withdrawNetwork === network
                            ? `${balanceModal.color}90`
                            : `${balanceModal.color}25`,
                        color:
                          withdrawNetwork === network
                            ? balanceModal.color
                            : "#7E8DAA",
                        background:
                          withdrawNetwork === network
                            ? `${balanceModal.color}18`
                            : "#050816",
                        boxShadow:
                          withdrawNetwork === network
                            ? `0 0 24px ${balanceModal.color}25`
                            : "none",
                      }}
                    >
                      {network}
                    </button>
                  ))}
                </div>

                <input
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  type="text"
                  placeholder="Введите адрес USDT кошелька"
                  className="mt-5 w-full rounded-[18px] border bg-[#050816] px-4 py-4 text-[#7FE7FF] outline-none"
                  style={{
                    borderColor: `${balanceModal.color}45`,
                  }}
                />
              </div>
            )}

            <input
              value={balanceAmount}
              onChange={(e) => {
                setBalanceAmount(e.target.value);
                if (balanceModal?.type === "deposit") {
                  setActiveDepositPayment(null);
                }
              }}
              type="number"
              placeholder={
                balanceModal.type === "withdraw"
                  ? "Введите сумму от 10 USDT"
                  : "Введите сумму"
              }
              className="mt-5 w-full rounded-[18px] border bg-[#050816] px-4 py-4 text-[#7FE7FF] outline-none"
              style={{
                borderColor: `${balanceModal.color}45`,
              }}
            />

            {financeError && (
              <p className="mt-3 text-[14px] text-red-400">{financeError}</p>
            )}

            {financeAmount > 0 && !financeError && (
              <div
                className="mt-5 rounded-[22px] border p-4"
                style={{
                  borderColor: `${balanceModal.color}35`,
                  background: `${balanceModal.color}08`,
                }}
              >
                <p
                  className="text-[13px] font-bold"
                  style={{ color: balanceModal.color }}
                >
                  РАСЧЁТ ОПЕРАЦИИ
                </p>

                <div className="mt-4 space-y-3 text-[15px] text-[#9DDFF0]">
                  <p>Сумма операции: {financeAmount.toFixed(2)} USDT</p>

                  {balanceModal.type === "transferWork" && (
                    <>
                      <p>Комиссия: {commission.toFixed(2)} USDT</p>
                      <p>Будет зачислено: {finalReceive.toFixed(2)} USDT</p>
                    </>
                  )}

                  {balanceModal.type === "withdraw" && (
                    <>
                      <p>Сеть: {withdrawNetwork}</p>
                      <p>Комиссия вывода: 0.00 USDT</p>
                      <p>К выплате: {financeAmount.toFixed(2)} USDT</p>
                      <p>Обработка: до 24 часов</p>
                    </>
                  )}

                  {balanceModal.type === "deposit" && (
                    <>
                      <p>Сеть: {depositNetwork}</p>
                      <p>Сумма пополнения: {financeAmount.toFixed(2)} USDT</p>
                      <p>Время оплаты адреса: 30 минут</p>
                    </>
                  )}

                  {balanceModal.type !== "transferWork" &&
                    balanceModal.type !== "withdraw" &&
                    balanceModal.type !== "deposit" && (
                      <p>
                        Будет зачислено/обработано:{" "}
                        {financeAmount.toFixed(2)} USDT
                      </p>
                    )}
                </div>
              </div>
            )}


            {balanceModal.type === "deposit" && activeDepositPayment && (
              <div
                className="mt-5 rounded-[22px] border p-4"
                style={{
                  borderColor: `${balanceModal.color}45`,
                  background: `${balanceModal.color}08`,
                  boxShadow: `0 0 28px ${balanceModal.color}14`,
                }}
              >
                <p
                  className="text-[13px] font-bold"
                  style={{ color: balanceModal.color }}
                >
                  РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ
                </p>

                {getDepositQr(activeDepositPayment) && (
                  <div className="mt-4 flex justify-center">
                    <div className="rounded-[22px] border border-[#00E5FF]/25 bg-white p-3">
                      <img
                        src={getDepositQr(activeDepositPayment)}
                        alt="QR для пополнения"
                        className="h-[160px] w-[160px]"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-3 text-[15px] text-[#9DDFF0]">
                  <p>Сеть: {activeDepositPayment.network || depositNetwork}</p>
                  <p>Валюта: {activeDepositPayment.currency || "USDT"}</p>
                  <p>
                    Сумма:{" "}
                    {Number(activeDepositPayment.amount || financeAmount || 0).toFixed(2)} USDT
                  </p>

                  <div className="rounded-[16px] border border-[#00E5FF]/20 bg-[#050816]/70 p-3">
                    <p className="text-[12px] font-bold text-[#7E8DAA]">
                      АДРЕС ДЛЯ ОПЛАТЫ
                    </p>

                    <p className="mt-2 break-all text-[14px] font-black text-[#7FE7FF]">
                      {activeDepositPayment.address}
                    </p>
                  </div>

                  <p className="text-[13px] leading-relaxed text-[#7E8DAA]">
                    Отправляйте только USDT в сети{" "}
                    {activeDepositPayment.network || depositNetwork}. После подтверждения платежа баланс пополнится автоматически.
                  </p>
                </div>

                <button
                  onClick={() => copyDepositAddress(activeDepositPayment.address)}
                  className="mt-4 flex w-full items-center justify-center gap-3 rounded-[18px] border border-[#00E5FF]/55 bg-[#00E5FF]/10 py-4 font-black text-[#00E5FF]"
                  style={{
                    boxShadow: "0 0 24px rgba(0,229,255,.18), inset 0 0 16px rgba(0,229,255,.08)",
                    textShadow: "0 0 10px rgba(0,229,255,.6)",
                  }}
                >
                  <FaCopy />
                  {copiedDepositAddress ? "АДРЕС СКОПИРОВАН" : "КОПИРОВАТЬ АДРЕС"}
                </button>
              </div>
            )}

            <button
              onClick={handleBalanceConfirm}
              disabled={!financeAmount || !!financeError}
              className="mt-5 w-full rounded-[20px] py-4 font-bold disabled:opacity-40"
              style={{
                background: `${balanceModal.color}22`,
                color: balanceModal.color,
                border: `1px solid ${balanceModal.color}80`,
                boxShadow: `0 0 30px ${balanceModal.color}25`,
              }}
            >
              {balanceModal.type === "deposit"
                ? activeDepositPayment
                  ? "СОЗДАТЬ НОВЫЙ АДРЕС"
                  : "СОЗДАТЬ АДРЕС"
                : balanceModal.type === "withdraw"
                ? "СОЗДАТЬ ЗАЯВКУ"
                : "ПОДТВЕРДИТЬ"}
            </button>
          </div>
        </div>
      )}

      {lineModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 backdrop-blur-md">
          <div
            className="relative max-h-[82vh] w-full max-w-[430px] overflow-y-auto rounded-[30px] border bg-[#0B1220] p-6 shadow-[0_0_55px_rgba(0,229,255,.14)]"
            style={{ borderColor: `${lineModal.color}55` }}
          >
            <button
              onClick={() => setLineModal(null)}
              className="absolute right-5 top-5 text-[#7FE7FF]"
            >
              <FaTimes />
            </button>

            <h3
              className="text-[28px] font-black uppercase"
              style={{
                color: lineModal.color,
                textShadow: `0 0 18px ${lineModal.color}55`,
              }}
            >
              {lineModal.line}
            </h3>

            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
              Список партнёров в этой линии: тариф, сумма депозита и текущий статус.
            </p>

            <div
              className="mt-5 rounded-[22px] border p-4"
              style={{
                borderColor: `${lineModal.color}35`,
                background: `${lineModal.color}08`,
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] font-bold text-[#7E8DAA]">
                    ПАРТНЁРОВ
                  </p>
                  <p
                    className="mt-1 text-[20px] font-black"
                    style={{ color: lineModal.color }}
                  >
                    {lineModal.partners}
                  </p>
                </div>

                <div>
                  <p className="text-[12px] font-bold text-[#7E8DAA]">
                    ОБОРОТ
                  </p>
                  <p
                    className="mt-1 text-[20px] font-black"
                    style={{ color: lineModal.color }}
                  >
                    {lineModal.turnover}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {lineModal.members.map((member, index) => {
                const deposits = getMemberDeposits(member);
                const totalDeposit = getMemberTotalDeposit(member);

                return (
                  <div
                    key={index}
                    className="rounded-[22px] border bg-[#050816]/70 p-4"
                    style={{
                      borderColor: `${member.color}30`,
                      boxShadow: `0 0 22px ${member.color}10`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className="text-[17px] font-black"
                          style={{
                            color: member.color,
                            textShadow: `0 0 12px ${member.color}55`,
                          }}
                        >
                          {member.user}
                        </p>

                        <p className="mt-1 text-[13px] text-[#7E8DAA]">
                          Статус: {member.status}
                        </p>

                        <p className="mt-1 text-[13px] text-[#7E8DAA]">
                          Активных сейфов: {deposits.length}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-[16px] font-black"
                          style={{ color: member.color }}
                        >
                          {totalDeposit.toLocaleString("ru-RU")} USDT
                        </p>

                        <p className="mt-1 text-[12px] text-[#7E8DAA]">
                          общий депозит
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {deposits.map((deposit, depositIndex) => (
                        <div
                          key={depositIndex}
                          className="flex items-center justify-between gap-3 rounded-[16px] border bg-[#0B1220]/70 px-3 py-3"
                          style={{
                            borderColor: `${deposit.color || member.color}28`,
                          }}
                        >
                          <p
                            className="text-[13px] font-black"
                            style={{
                              color: deposit.color || member.color,
                              textShadow: `0 0 10px ${
                                deposit.color || member.color
                              }55`,
                            }}
                          >
                            {deposit.safe}
                          </p>

                          <p
                            className="text-[13px] font-black"
                            style={{ color: deposit.color || member.color }}
                          >
                            {deposit.deposit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {lineModal.members.length === 0 && (
              <p className="mt-5 text-[13px] leading-relaxed text-[#7E8DAA]">
                В этой линии пока нет партнёров.
              </p>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-5 left-1/2 z-50 w-[92%] max-w-[520px] -translate-x-1/2">
        <div className="relative rounded-[28px] border border-[#00E5FF]/10 bg-[#0B1220]/90 backdrop-blur-2xl px-3 py-3 shadow-[0_0_30px_rgba(0,229,255,.08)]">
          <div className="grid grid-cols-4 gap-2">
            {nav.map((item) => {
              const active = page === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => {
  setPage(item.key);
  window.scrollTo({ top: 0, behavior: "smooth" });
}}
                  className={`rounded-[22px] py-3 transition-all duration-300 ${
                    active ? "bg-[#111827]" : "bg-transparent"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="text-[20px]"
                      style={{
                        color: active ? item.color : "#64748B",
                        filter: active
                          ? `drop-shadow(0 0 12px ${item.color})`
                          : "none",
                      }}
                    >
                      {item.icon}
                    </div>

                    <span
                      className={`text-[13px] ${
                        active ? "text-[#39FF14]" : "text-[#8A94A7]"
                      }`}
                      style={{
                        fontFamily: "Exo 2",
                        fontWeight: 800,
                        letterSpacing: "0.2px",
                        textShadow: active
                          ? "0 0 10px rgba(57,255,20,.65)"
                          : "0 0 8px rgba(120,130,160,.08)",
                      }}
                    >
                      {item.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function Info({ label, value, color }) {
  return (
    <div
      className="rounded-[18px] border p-3"
      style={{
        borderColor: `${color}22`,
        background: `${color}08`,
        boxShadow: `inset 0 0 18px ${color}08`,
      }}
    >
      <p
        className="text-[12px] font-semibold"
        style={{
          color,
          opacity: 0.75,
        }}
      >
        {label}
      </p>

      <p
        className="mt-1 text-[14px] font-black"
        style={{
          color,
          textShadow: `0 0 10px ${color}55`,
        }}
      >
        {value}
      </p>
    </div>
  );
}


function PartnerStatCard({ label, value, color }) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] border p-4"
      style={{
        borderColor: `${color}30`,
        background: `${color}08`,
        boxShadow: `0 0 26px ${color}12, inset 0 0 18px ${color}08`,
      }}
    >
      <div
        className="absolute right-[-45px] top-[-45px] h-[120px] w-[120px] rounded-full blur-[70px]"
        style={{ background: `${color}20` }}
      />

      <div className="relative z-10">
        <p
          className="text-[12px] font-bold uppercase leading-snug"
          style={{
            color,
            opacity: 0.82,
          }}
        >
          {label}
        </p>

        <p
          className="mt-3 text-[24px] font-black leading-none"
          style={{
            color,
            textShadow: `0 0 16px ${color}55`,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function BalanceCard({ title, value, color, description, actions, bg }) {
  return (
    <div
      className="relative overflow-hidden rounded-[32px] border p-5"
      style={{
        borderColor: `${color}40`,
        boxShadow: `0 0 34px ${color}12`,
        backgroundImage: `url('${bg}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[#050816]/76" />

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(5,8,22,.2), rgba(5,8,22,.95)), linear-gradient(90deg, rgba(5,8,22,.92), ${color}20)`,
        }}
      />

      <div
        className="absolute right-[-70px] top-[-70px] h-[210px] w-[210px] rounded-full blur-[100px]"
        style={{ background: `${color}25` }}
      />

      <div className="relative z-10">
        <p
          className="text-[14px] font-black tracking-[3px]"
          style={{
            color,
            textShadow: `0 0 14px ${color}66`,
          }}
        >
          {title.toUpperCase()}
        </p>

        <p
          className="mt-4 text-[42px] font-black leading-none"
          style={{
            color,
            textShadow: `0 0 22px ${color}55`,
          }}
        >
          {value.toLocaleString("ru-RU")}
        </p>

        <p className="mt-2 text-[16px] font-bold" style={{ color }}>
          USDT
        </p>

        <p className="mt-5 text-[15px] font-semibold leading-relaxed text-[#7FE7FF]">
          {description}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="flex items-center justify-center gap-2 rounded-[20px] border py-4 font-black"
              style={{
                borderColor: `${color}65`,
                color,
                background: `${color}12`,
                boxShadow: `0 0 24px ${color}22, inset 0 0 18px ${color}10`,
                textShadow: `0 0 10px ${color}66`,
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}