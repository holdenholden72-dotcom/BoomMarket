// === Адрес бэкенда на Railway ===
const API_URL = 'https://boom-backend-production-46b5.up.railway.app';

const items = [
    { id: 1, name: "Ice Cream", number: 56824, price: 3.37, time: 1719000000, model: "Classic", bg: "#b5a48d", symbol: "☘️", img: "https://images.emojiterra.com/google/android-12l/512px/1f366.png" },
    { id: 2, name: "Ice Cream", number: 217820, price: 3.41, time: 1719005000, model: "Classic", bg: "#7ec8e3", symbol: "☘️", img: "https://images.emojiterra.com/google/android-12l/512px/1f366.png" },
    { id: 3, name: "Ice Cream", number: 12450, price: 2.99, time: 1690000000, model: "Classic", bg: "#a8e6cf", symbol: "☘️", img: "https://images.emojiterra.com/google/android-12l/512px/1f366.png" },
    { id: 4, name: "Ice Cream", number: 99432, price: 4.10, time: 1719010000, model: "Classic", bg: "#ffd3b6", symbol: "☘️", img: "https://images.emojiterra.com/google/android-12l/512px/1f366.png" }
];

const grid = document.getElementById('marketGrid');
const searchInput = document.getElementById('searchInput');
const sortTriggerBtn = document.getElementById('sortTriggerBtn');
const sortModal = document.getElementById('sortModal');

// Элементы для переключения экранов
const marketScreen = document.getElementById('marketScreen');
const profileScreen = document.getElementById('profileScreen');
const openProfileBtn = document.getElementById('openProfileBtn');
const backToMarketBtn = document.getElementById('backToMarketBtn');

// Открытие профиля
openProfileBtn.addEventListener('click', () => {
    marketScreen.classList.remove('active');
    profileScreen.classList.add('active');
});

// Возврат в маркет
backToMarketBtn.addEventListener('click', () => {
    profileScreen.classList.remove('active');
    marketScreen.classList.add('active');
});

function renderGrid(data) {
    grid.innerHTML = '';
    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'nft-card';
        card.innerHTML = `
            <div class="nft-image-container" style="background-color: ${item.bg};">
                <div class="nft-badge">${item.symbol}</div>
                <img src="${item.img}" class="nft-img" alt="${item.name}">
            </div>
            <div class="nft-info">
                <div class="nft-title">${item.name}</div>
                <div class="nft-number">#${item.number}</div>
                <div class="nft-bottom">
                    <div class="nft-price">💎 ${item.price}</div>
                    <button class="cart-btn">🛒</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

renderGrid(items);

sortTriggerBtn.addEventListener('click', () => {
    sortModal.classList.toggle('active');
});

sortModal.addEventListener('click', (e) => {
    if (e.target === sortModal) {
        sortModal.classList.remove('active');
    }
});

document.querySelectorAll('.sort-content li').forEach(li => {
    li.addEventListener('click', () => {
        document.querySelectorAll('.sort-content li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');

        const type = li.getAttribute('data-sort');

        if (type === 'time_asc') items.sort((a, b) => a.time - b.time);
        if (type === 'time_desc') items.sort((a, b) => b.time - a.time);
        if (type === 'price_asc') items.sort((a, b) => a.price - b.price);
        if (type === 'price_desc') items.sort((a, b) => b.price - a.price);
        if (type === 'num_asc') items.sort((a, b) => a.number - b.number);
        if (type === 'num_desc') items.sort((a, b) => b.number - a.number);

        sortModal.classList.remove('active');
        renderGrid(items);
    });
});

searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = items.filter(i => i.name.toLowerCase().includes(val));
    renderGrid(filtered);
});

// Инициализация TonConnect UI для подключения кошелька с именем BoomMarket
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://holdenholden72-dotcom.github.io/BoomMarket/tonconnect-manifest.json',
    buttonRootId: 'walletBtn'
});

// === Telegram WebApp + реальная авторизация через бэкенд ===
const tg = window.Telegram?.WebApp;

// Храним initData в памяти на время сессии — используется как "пропуск"
// для запросов к защищённым эндпоинтам (/api/balance, /api/deposit, /api/withdraw).
// В будущем стоит заменить на нормальный JWT-токен, выданный сервером один раз при входе.
let currentInitData = null;

function updateBalanceUI(balance) {
    const userBalanceElements = document.querySelectorAll('.user-balance');
    userBalanceElements.forEach(el => {
        el.textContent = Number(balance).toFixed(2);
    });
}

function showAuthError(message) {
    console.error('Ошибка авторизации:', message);
    // Не пугаем пользователя алертом при каждом открытии — просто лог в консоль.
    // Баланс останется 0, пока не решится проблема с авторизацией.
}

async function authenticateWithBackend(initData) {
    try {
        const res = await fetch(`${API_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
        });

        const data = await res.json();

        if (!data.ok) {
            showAuthError(data.error || 'Неизвестная ошибка');
            return;
        }

        currentInitData = initData;
        updateBalanceUI(data.user.balance);

        console.log('Авторизован как:', data.user.username || data.user.first_name);
    } catch (e) {
        showAuthError(e.message);
    }
}

if (tg) {
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;

    if (user && user.photo_url) {
        const avatarElement = document.getElementById('openProfileBtn');
        if (avatarElement) {
            avatarElement.src = user.photo_url;
        }
    }

    // initData — подписанная строка, проверяется на сервере.
    // Именно её, а не initDataUnsafe, нужно слать на бэкенд.
    if (tg.initData) {
        authenticateWithBackend(tg.initData);
    } else {
        console.log('initData пуст — вероятно, открыто не из Telegram');
    }
} else {
    console.log('Открыто не в Telegram');
}

// === БЛОК ВЫВОДА СРЕДСТВ ===
const withdrawModal = document.getElementById('withdrawModal');
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');

if (confirmWithdrawBtn) {
    confirmWithdrawBtn.addEventListener('click', async () => {
        const amount = parseFloat(withdrawAmountInput.value);

        if (isNaN(amount) || amount < 0.5) {
            alert('Минимальная сумма для вывода: 0.5!');
            return;
        }

        if (!currentInitData) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': currentInitData,
                },
                body: JSON.stringify({ amount }),
            });

            const data = await res.json();

            if (!data.ok) {
                alert(data.error || 'Не удалось выполнить вывод');
                return;
            }

            updateBalanceUI(data.balance);
            alert(`Запрос на вывод ${amount} успешно создан!`);

            if (withdrawModal) {
                withdrawModal.style.display = 'none';
            }
            withdrawAmountInput.value = '';
        } catch (e) {
            alert('Ошибка соединения с сервером');
            console.error(e);
        }
    });
}

// === БЛОК ПОПОЛНЕНИЯ СРЕДСТВ ===
const depositModal = document.getElementById('depositModal');
const plusDepositBtn = document.getElementById('plusDepositBtn');
const quickDepositBtn = document.getElementById('quickDepositBtn');
const closeDepositModalBtn = document.getElementById('closeDepositModal');
const confirmDepositBtn = document.getElementById('confirmDepositBtn');
const depositAmountInput = document.getElementById('depositAmount');

if (quickDepositBtn && depositModal) {
    quickDepositBtn.addEventListener('click', () => {
        depositModal.style.display = 'flex';
    });
}

if (plusDepositBtn && depositModal) {
    plusDepositBtn.addEventListener('click', () => {
        depositModal.style.display = 'flex';
    });
}

if (closeDepositModalBtn && depositModal) {
    closeDepositModalBtn.addEventListener('click', () => {
        depositModal.style.display = 'none';
    });
}

if (confirmDepositBtn && depositAmountInput) {
    confirmDepositBtn.addEventListener('click', async () => {
        const amount = parseFloat(depositAmountInput.value);

        if (isNaN(amount) || amount < 0.01) {
            alert('Минимальная сумма для пополнения: 0.01');
            return;
        }

        if (!currentInitData) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        // ВАЖНО: сейчас это зачисляет сумму без проверки реального TON-платежа.
        // Это временная заглушка — когда подключим приём настоящих транзакций
        // через TON Connect, здесь будет проверка транзакции в блокчейне вместо
        // прямого вызова /api/deposit с фронтенда.
        try {
            const res = await fetch(`${API_URL}/api/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': currentInitData,
                },
                body: JSON.stringify({ amount }),
            });

            const data = await res.json();

            if (!data.ok) {
                alert(data.error || 'Не удалось выполнить пополнение');
                return;
            }

            updateBalanceUI(data.balance);
            alert(`Баланс успешно пополнен на ${amount}!`);
            depositModal.style.display = 'none';
            depositAmountInput.value = '';
        } catch (e) {
            alert('Ошибка соединения с сервером');
            console.error(e);
        }
    });
}

// Открытие и закрытие модального окна вывода
const withdrawBtn = document.getElementById('withdrawBtn');
const closeWithdrawModalBtn = document.getElementById('closeWithdrawModal');

if (withdrawBtn && withdrawModal) {
    withdrawBtn.addEventListener('click', () => {
        withdrawModal.style.display = 'flex';
    });
}

if (closeWithdrawModalBtn && withdrawModal) {
    closeWithdrawModalBtn.addEventListener('click', () => {
        withdrawModal.style.display = 'none';
    });
}
