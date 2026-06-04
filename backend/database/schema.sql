CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150),
    password_hash TEXT,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    twofa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    main_balance NUMERIC(18, 6) DEFAULT 0,
    referral_balance NUMERIC(18, 6) DEFAULT 0,
    working_balance NUMERIC(18, 6) DEFAULT 0,
    total_deposited NUMERIC(18, 6) DEFAULT 0,
    total_withdrawn NUMERIC(18, 6) DEFAULT 0,
    total_earned NUMERIC(18, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safe_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    min_amount NUMERIC(18, 6) NOT NULL,
    max_amount NUMERIC(18, 6) NOT NULL,
    daily_percent NUMERIC(10, 4) NOT NULL,
    referral_boost_percent NUMERIC(10, 4) NOT NULL,
    max_multiplier NUMERIC(10, 4) DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES safe_plans(id),
    amount NUMERIC(18, 6) NOT NULL,
    daily_percent NUMERIC(10, 4) NOT NULL,
    boost_percent NUMERIC(10, 4) DEFAULT 0,
    total_percent NUMERIC(10, 4) NOT NULL,
    earned_amount NUMERIC(18, 6) DEFAULT 0,
    max_return_amount NUMERIC(18, 6) NOT NULL,
    status VARCHAR(30) DEFAULT 'active',
    opened_at TIMESTAMP DEFAULT NOW(),
    next_accrual_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network VARCHAR(20) NOT NULL,
    currency VARCHAR(20) DEFAULT 'USDT',
    amount NUMERIC(18, 6),
    address TEXT,
    tx_hash TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    provider_payload JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network VARCHAR(20) NOT NULL,
    wallet_address TEXT NOT NULL,
    amount NUMERIC(18, 6) NOT NULL,
    fee_amount NUMERIC(18, 6) DEFAULT 0,
    final_amount NUMERIC(18, 6) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    tx_hash TEXT,
    admin_comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    balance_type VARCHAR(30) NOT NULL,
    amount NUMERIC(18, 6) NOT NULL,
    status VARCHAR(30) DEFAULT 'completed',
    description TEXT,
    related_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deposit_id UUID REFERENCES user_deposits(id) ON DELETE SET NULL,
    level INTEGER NOT NULL,
    percent NUMERIC(10, 4) NOT NULL,
    amount NUMERIC(18, 6) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secret_safe_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    displayed_fund NUMERIC(18, 6) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secret_safe_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(18, 6) NOT NULL,
    status VARCHAR(30) DEFAULT 'active',
    expires_at TIMESTAMP,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO safe_plans (code, name, min_amount, max_amount, daily_percent, referral_boost_percent, max_multiplier)
VALUES
('basic', 'BASIC SAFE', 10, 2500, 10, 0.1, 2),
('standard', 'STANDARD SAFE', 250, 5000, 12.5, 0.3, 2),
('vip', 'VIP SAFE', 500, 10000, 16.75, 0.5, 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO secret_safe_settings (id, displayed_fund)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;