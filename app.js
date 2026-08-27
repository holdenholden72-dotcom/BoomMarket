// === Адрес бэкенда на Railway ===
const API_URL = 'https://boom-backend-production-dc56.up.railway.app';

// === Состояние фильтров/сортировки для витрины ===
let currentFilters = {
    collectionId: null,
    model: null,
    backdrop: null,
    symbol: null,
    search: '',
    sort: null,
};

const grid = document.getElementById('marketGrid');
const searchInput = document.getElementById('searchInput');
const sortTriggerBtn = document.getElementById('sortTriggerBtn');
const sortModal = document.getElementById('sortModal');
const filterNftSelect = document.getElementById('filterNft');
const filterModelSelect = document.getElementById('filterModel');
const filterBgSelect = document.getElementById('filterBg');
const filterSymbolSelect = document.getElementById('filterSymbol');

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// Фонов без цвета в базе (color_hex мы пока не собираем) — генерируем
// стабильный цвет по названию фона, чтобы карточки не были все одинаковые.
function backdropColor(name) {
    if (!name) return '#2c2c2e';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 35%, 32%)`;
}

function renderGrid(listings) {
    grid.innerHTML = '';

    if (!listings.length) {
        grid.innerHTML = '<div class="empty-state">Пока нет активных лотов — загляните позже</div>';
        return;
    }

    listings.forEach(item => {
        const card = document.createElement('div');
        card.className = 'nft-card';
        const bg = item.backdrop_color || backdropColor(item.backdrop_name);
        const badge = item.symbol_icon
            ? `<img src="${item.symbol_icon}" style="width:18px;height:18px;">`
            : (item.symbol_name || '');
        const title = item.model_name
            ? `${escapeHtml(item.collection_name)} · ${escapeHtml(item.model_name)}`
            : escapeHtml(item.collection_name);

        card.innerHTML = `
            <div class="nft-image-container" style="background-color: ${bg};">
                <div class="nft-badge">${badge}</div>
                <img src="${item.collection_image || ''}" class="nft-img" alt="${escapeHtml(item.collection_name)}">
            </div>
            <div class="nft-info">
                <div class="nft-title">${title}</div>
                <div class="nft-number">#${item.gift_number}</div>
                <div class="nft-bottom">
                    <div class="nft-price">💎 ${item.price}</div>
                    <button class="cart-btn">🛒</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// === Загрузка коллекций и лотов с бэкенда ===
async function fetchJSON(url) {
    const res = await fetch(url);
    return res.json();
}

async function loadCollections() {
    try {
        const data = await fetchJSON(`${API_URL}/api/collections`);
        const collections = data.collections || [];
        filterNftSelect.innerHTML =
            '<option value="">NFT</option>' +
            collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch (e) {
        console.error('Ошибка загрузки коллекций:', e);
    }
}

async function loadFiltersForCollection(collectionId) {
    if (!collectionId) {
        filterModelSelect.innerHTML = '<option value="">Модель</option>';
        filterBgSelect.innerHTML = '<option value="">Фон</option>';
        filterSymbolSelect.innerHTML = '<option value="">Символ</option>';
        return;
    }

    try {
        const data = await fetchJSON(`${API_URL}/api/collections/${collectionId}/filters`);
        const { models = [], backdrops = [], symbols = [] } = data.filters || {};

        filterModelSelect.innerHTML =
            '<option value="">Модель</option>' +
            models.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
        filterBgSelect.innerHTML =
            '<option value="">Фон</option>' +
            backdrops.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join('');
        filterSymbolSelect.innerHTML =
            '<option value="">Символ</option>' +
            symbols.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    } catch (e) {
        console.error('Ошибка загрузки фильтров коллекции:', e);
    }
}

async function loadListings() {
    const params = new URLSearchParams();
    if (currentFilters.collectionId) params.set('collectionId', currentFilters.collectionId);
    if (currentFilters.model) params.set('model', currentFilters.model);
    if (currentFilters.backdrop) params.set('backdrop', currentFilters.backdrop);
    if (currentFilters.symbol) params.set('symbol', currentFilters.symbol);
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (currentFilters.sort) params.set('sort', currentFilters.sort);

    try {
        const data = await fetchJSON(`${API_URL}/api/listings?${params.toString()}`);
        renderGrid(data.listings || []);
    } catch (e) {
        console.error('Ошибка загрузки листингов:', e);
        renderGrid([]);
    }
}

// Инициализация витрины
loadCollections();
loadListings();

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

        currentFilters.sort = li.getAttribute('data-sort');
        sortModal.classList.remove('active');
        loadListings();
    });
});

filterNftSelect.addEventListener('change', async () => {
    currentFilters.collectionId = filterNftSelect.value || null;
    currentFilters.model = null;
    currentFilters.backdrop = null;
    currentFilters.symbol = null;
    await loadFiltersForCollection(currentFilters.collectionId);
    loadListings();
});

filterModelSelect.addEventListener('change', () => {
    currentFilters.model = filterModelSelect.value || null;
    loadListings();
});

filterBgSelect.addEventListener('change', () => {
    currentFilters.backdrop = filterBgSelect.value || null;
    loadListings();
});

filterSymbolSelect.addEventListener('change', () => {
    currentFilters.symbol = filterSymbolSelect.value || null;
    loadListings();
});

let searchDebounceTimer = null;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const val = e.target.value;
    searchDebounceTimer = setTimeout(() => {
        currentFilters.search = val;
        loadListings();
    }, 300);
});

// Инициализация TonConnect UI для подключения кошелька с именем BoomMarket
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://holdenholden72-dotcom.github.io/BoomMarket/tonconnect-manifest.json',
    buttonRootId: 'walletBtn'
});

// === Telegram WebApp + авторизация через бэкенд по JWT ===
const tg = window.Telegram?.WebApp;

// Токен сессии — выдаётся сервером один раз при /api/auth и живёт 24 часа.
// Хранится только в памяти вкладки: закрыл приложение — при следующем открытии
// initData снова под рукой у Telegram, и мы просто получаем новый токен.
let authToken = null;

function updateBalanceUI(balance) {
    const userBalanceElements = document.querySelectorAll('.user-balance');
    userBalanceElements.forEach(el => {
        el.textContent = Number(balance).toFixed(2);
    });
}

function showAuthError(message) {
    console.error('Ошибка авторизации:', message);
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

        authToken = data.token;
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

        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
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

        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        // ВАЖНО: сейчас это зачисляет сумму без проверки реального TON-платежа.
        // Временная заглушка — когда подключим TON Connect, здесь будет проверка
        // настоящей транзакции в блокчейне вместо прямого вызова /api/deposit.
        try {
            const res = await fetch(`${API_URL}/api/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
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
