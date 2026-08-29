// === Адрес бэкенда на Railway ===
const API_URL = 'https://boom-backend-production-dc56.up.railway.app';

const grid = document.getElementById('marketGrid');
const searchInput = document.getElementById('searchInput');
const sortTriggerBtn = document.getElementById('sortTriggerBtn');
const sortModal = document.getElementById('sortModal');

// Элементы для переключения экранов
const marketScreen = document.getElementById('marketScreen');
const profileScreen = document.getElementById('profileScreen');
const openProfileBtn = document.getElementById('openProfileBtn');
const backToMarketBtn = document.getElementById('backToMarketBtn');

openProfileBtn.addEventListener('click', () => {
    marketScreen.classList.remove('active');
    profileScreen.classList.add('active');
});

backToMarketBtn.addEventListener('click', () => {
    profileScreen.classList.remove('active');
    marketScreen.classList.add('active');
});

// =====================================================================
// СОСТОЯНИЕ ФИЛЬТРОВ И ДАННЫХ
// =====================================================================

// Текущие применённые фильтры (мультивыбор — везде массивы)
const activeFilters = {
    collectionIds: [],   // выбранные id коллекций (NFT)
    models: [],          // выбранные названия моделей
    backdrops: [],        // выбранные названия фонов
    symbols: [],          // выбранные названия символов
    sort: null,
};

let currentSearch = '';

// Кэш справочников с сервера
let collectionsCache = [];       // [{id, name, image_url}]
let traitsCache = { models: [], backdrops: [], symbols: [] }; // зависит от выбранных коллекций

// =====================================================================
// ОБЩАЯ МОДАЛКА МУЛЬТИВЫБОРА (переиспользуется для 4 фильтров)
// =====================================================================

const filterPickerModal = document.getElementById('filterPickerModal');
const filterPickerTitle = document.getElementById('filterPickerTitle');
const filterPickerSearch = document.getElementById('filterPickerSearch');
const filterPickerSelectAll = document.getElementById('filterPickerSelectAll');
const filterPickerList = document.getElementById('filterPickerList');
const filterPickerReset = document.getElementById('filterPickerReset');
const filterPickerApply = document.getElementById('filterPickerApply');
const closeFilterPicker = document.getElementById('closeFilterPicker');

const filterButtons = {
    collection: document.getElementById('filterNftBtn'),
    model: document.getElementById('filterModelBtn'),
    backdrop: document.getElementById('filterBgBtn'),
    symbol: document.getElementById('filterSymbolBtn'),
};

const filterTitles = {
    collection: 'Коллекция',
    model: 'Модель',
    backdrop: 'Фон',
    symbol: 'Символ',
};

const filterStateKeys = {
    collection: 'collectionIds',
    model: 'models',
    backdrop: 'backdrops',
    symbol: 'symbols',
};

// Текущий открытый фильтр и его временный (черновой) выбор — применяется
// только по кнопке "Показать результаты", отменяется при закрытии крестиком.
let openFilterType = null;
let draftSelection = new Set();

/** Возвращает список опций {value, label, image, colorHex, rarity} для указанного типа фильтра. */
function getOptionsForFilterType(type) {
    if (type === 'collection') {
        return collectionsCache.map(c => ({
            value: String(c.id),
            label: c.name,
            image: c.image_url,
        }));
    }
    if (type === 'model') {
        return traitsCache.models.map(m => ({
            value: m.name,
            label: m.name,
            image: m.image_url,
            rarity: m.rarity_permille,
        }));
    }
    if (type === 'backdrop') {
        return traitsCache.backdrops.map(b => ({
            value: b.name,
            label: b.name,
            colorHex: b.color_hex,
            image: b.image_url,
            rarity: b.rarity_permille,
        }));
    }
    if (type === 'symbol') {
        return traitsCache.symbols.map(s => ({
            value: s.name,
            label: s.name,
            image: s.icon_url,
            rarity: s.rarity_permille,
        }));
    }
    return [];
}

function renderFilterPickerList() {
    const search = filterPickerSearch.value.trim().toLowerCase();
    const allOptions = getOptionsForFilterType(openFilterType);
    let visibleOptions = search
        ? allOptions.filter(o => o.label.toLowerCase().includes(search))
        : allOptions;

    // Выбранные — наверх списка, порядок внутри каждой группы (выбрано/не выбрано)
    // сохраняем как был (алфавитный, как отдаёт бэкенд) — сортировка стабильная.
    visibleOptions = visibleOptions
        .slice()
        .sort((a, b) => (draftSelection.has(b.value) ? 1 : 0) - (draftSelection.has(a.value) ? 1 : 0));

    filterPickerList.innerHTML = '';

    if (visibleOptions.length === 0) {
        filterPickerList.innerHTML = `<li class="filter-picker-empty">Ничего не найдено</li>`;
        updateSelectAllCheckbox([]);
        return;
    }

    visibleOptions.forEach(opt => {
        const li = document.createElement('li');
        li.className = 'filter-picker-row';

        const checked = draftSelection.has(opt.value) ? 'checked' : '';

        let thumbHtml;
        if (opt.colorHex) {
            thumbHtml = `<span class="filter-picker-thumb is-color" style="background:${opt.colorHex}"></span>`;
        } else if (opt.image) {
            thumbHtml = `<img class="filter-picker-thumb" src="${opt.image}" alt="" loading="lazy">`;
        } else {
            thumbHtml = `<span class="filter-picker-thumb is-placeholder">?</span>`;
        }

        if (draftSelection.has(opt.value)) {
            li.classList.add('is-selected');
        }

        const rarityHtml = (opt.rarity !== undefined && opt.rarity !== null)
            ? `<span class="filter-picker-rarity">${opt.rarity}%</span>`
            : '';

        li.innerHTML = `
            <input type="checkbox" ${checked} data-value="${opt.value}">
            ${thumbHtml}
            <span class="filter-picker-name">${opt.label}</span>
            ${rarityHtml}
        `;

        li.addEventListener('click', (e) => {
            // Клик по самому чекбоксу уже переключает его — не переключаем дважды
            if (e.target.tagName !== 'INPUT') {
                const checkbox = li.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox.checked) {
                draftSelection.add(opt.value);
            } else {
                draftSelection.delete(opt.value);
            }
            // Перерисовываем список целиком — выбранный пункт переезжает наверх/обратно.
            renderFilterPickerList();
        });

        filterPickerList.appendChild(li);
    });

    updateSelectAllCheckbox(visibleOptions);
}

function updateSelectAllCheckbox(visibleOptions) {
    if (visibleOptions.length === 0) {
        filterPickerSelectAll.checked = false;
        filterPickerSelectAll.indeterminate = false;
        return;
    }
    const selectedCount = visibleOptions.filter(o => draftSelection.has(o.value)).length;
    filterPickerSelectAll.checked = selectedCount === visibleOptions.length;
    filterPickerSelectAll.indeterminate = selectedCount > 0 && selectedCount < visibleOptions.length;
}

function openFilterPicker(type) {
    openFilterType = type;
    draftSelection = new Set(activeFilters[filterStateKeys[type]]);
    filterPickerTitle.textContent = filterTitles[type];
    filterPickerSearch.value = '';
    renderFilterPickerList();
    filterPickerModal.classList.add('active');
}

function closeFilterPickerModal() {
    filterPickerModal.classList.remove('active');
    openFilterType = null;
}

Object.entries(filterButtons).forEach(([type, btn]) => {
    if (btn) btn.addEventListener('click', () => openFilterPicker(type));
});

closeFilterPicker.addEventListener('click', closeFilterPickerModal);

filterPickerModal.addEventListener('click', (e) => {
    if (e.target === filterPickerModal) closeFilterPickerModal();
});

filterPickerSearch.addEventListener('input', renderFilterPickerList);

filterPickerSelectAll.addEventListener('change', () => {
    const search = filterPickerSearch.value.trim().toLowerCase();
    const allOptions = getOptionsForFilterType(openFilterType);
    const visibleOptions = search
        ? allOptions.filter(o => o.label.toLowerCase().includes(search))
        : allOptions;

    if (filterPickerSelectAll.checked) {
        visibleOptions.forEach(o => draftSelection.add(o.value));
    } else {
        visibleOptions.forEach(o => draftSelection.delete(o.value));
    }
    renderFilterPickerList();
});

filterPickerReset.addEventListener('click', () => {
    draftSelection.clear();
    renderFilterPickerList();
});

filterPickerApply.addEventListener('click', async () => {
    const type = openFilterType;
    const key = filterStateKeys[type];
    activeFilters[key] = [...draftSelection];

    updateFilterPillUI(type);
    closeFilterPickerModal();

    // Если поменяли выбор коллекций (NFT) — модели/фоны/символы нужно
    // перезагрузить, сузив их до выбранных коллекций.
    if (type === 'collection') {
        await loadTraits();
    }

    await loadListings();
});

function updateFilterPillUI(type) {
    const btn = filterButtons[type];
    if (!btn) return;

    const key = filterStateKeys[type];
    const count = activeFilters[key].length;

    btn.innerHTML = filterTitles[type] === 'Коллекция' ? 'NFT' : filterTitles[type];
    if (count > 0) {
        btn.classList.add('has-selection');
        btn.innerHTML += ` <span class="pill-count">${count}</span>`;
    } else {
        btn.classList.remove('has-selection');
    }
}

// =====================================================================
// ЗАГРУЗКА СПРАВОЧНИКОВ И ЛИСТИНГОВ С СЕРВЕРА
// =====================================================================

async function loadCollections() {
    try {
        const res = await fetch(`${API_URL}/api/collections`);
        const data = await res.json();
        if (data.ok) collectionsCache = data.collections;
    } catch (e) {
        console.error('Не удалось загрузить коллекции:', e);
    }
}

async function loadTraits() {
    try {
        const params = new URLSearchParams();
        if (activeFilters.collectionIds.length) {
            params.set('collectionIds', activeFilters.collectionIds.join(','));
        }
        const res = await fetch(`${API_URL}/api/filters?${params.toString()}`);
        const data = await res.json();
        if (data.ok) traitsCache = data.filters;
    } catch (e) {
        console.error('Не удалось загрузить фильтры:', e);
    }
}

function buildListingsQuery() {
    const params = new URLSearchParams();
    if (activeFilters.collectionIds.length) params.set('collectionId', activeFilters.collectionIds.join(','));
    if (activeFilters.models.length) params.set('model', activeFilters.models.join(','));
    if (activeFilters.backdrops.length) params.set('backdrop', activeFilters.backdrops.join(','));
    if (activeFilters.symbols.length) params.set('symbol', activeFilters.symbols.join(','));
    if (currentSearch) params.set('search', currentSearch);
    if (activeFilters.sort) params.set('sort', activeFilters.sort);
    return params.toString();
}

async function loadListings() {
    try {
        const res = await fetch(`${API_URL}/api/listings?${buildListingsQuery()}`);
        const data = await res.json();
        if (data.ok) renderGrid(data.listings);
    } catch (e) {
        console.error('Не удалось загрузить листинги:', e);
        grid.innerHTML = `<div class="empty-state">Не удалось загрузить маркет. Проверьте соединение.</div>`;
    }
}

function renderGrid(listings) {
    grid.innerHTML = '';
    listingsById.clear();

    if (!listings || listings.length === 0) {
        grid.innerHTML = `<div class="empty-state">Пока нет активных лотов по выбранным фильтрам</div>`;
        return;
    }

    listings.forEach(item => {
        listingsById.set(String(item.id), item);

        const card = document.createElement('div');
        card.className = 'nft-card';

        const bg = item.backdrop_color || '#333';
        const image = item.model_icon || item.collection_image || '';

        card.innerHTML = `
            <div class="nft-image-container" style="background-color: ${bg};">
                ${image ? `<img src="${image}" class="nft-img" alt="${item.collection_name}">` : ''}
            </div>
            <div class="nft-info">
                <div class="nft-title">${item.collection_name}</div>
                <div class="nft-number">#${item.gift_number}</div>
                <div class="nft-bottom">
                    <div class="nft-price">💎 ${item.price}</div>
                    <button class="cart-btn" data-listing-id="${item.id}">🛒</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Кэш текущих загруженных лотов по id — чтобы открыть детальную карточку
// без повторного запроса к серверу, у нас уже есть все данные из /api/listings.
const listingsById = new Map();

// === Детальная карточка лота ===
const listingDetailModal = document.getElementById('listingDetailModal');
const closeListingDetailBtn = document.getElementById('closeListingDetail');
const listingDetailImageWrap = document.getElementById('listingDetailImageWrap');
const listingDetailImage = document.getElementById('listingDetailImage');
const listingDetailTitle = document.getElementById('listingDetailTitle');
const listingDetailNumber = document.getElementById('listingDetailNumber');
const listingDetailCollection = document.getElementById('listingDetailCollection');
const listingDetailModel = document.getElementById('listingDetailModel');
const listingDetailBackdrop = document.getElementById('listingDetailBackdrop');
const listingDetailSymbol = document.getElementById('listingDetailSymbol');
const listingDetailPrice = document.getElementById('listingDetailPrice');
const listingDetailBuyBtn = document.getElementById('listingDetailBuyBtn');

let currentDetailListingId = null;

function traitLabel(name) {
    return name || '—';
}

function openListingDetail(item) {
    currentDetailListingId = item.id;

    const image = item.model_icon || item.collection_image || '';
    listingDetailImageWrap.style.backgroundColor = item.backdrop_color || '#333';
    listingDetailImage.src = image;
    listingDetailTitle.textContent = item.collection_name;
    listingDetailNumber.textContent = `#${item.gift_number}`;
    listingDetailCollection.textContent = item.collection_name;
    listingDetailModel.textContent = traitLabel(item.model_name);
    listingDetailBackdrop.textContent = traitLabel(item.backdrop_name);
    listingDetailSymbol.textContent = traitLabel(item.symbol_name);
    listingDetailPrice.textContent = item.price;

    listingDetailModal.style.display = 'flex';
}

grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.cart-btn');
    if (!btn) return;

    const item = listingsById.get(btn.dataset.listingId);
    if (!item) return;

    openListingDetail(item);
});

if (closeListingDetailBtn && listingDetailModal) {
    closeListingDetailBtn.addEventListener('click', () => {
        listingDetailModal.style.display = 'none';
        currentDetailListingId = null;
    });
}

if (listingDetailBuyBtn) {
    listingDetailBuyBtn.addEventListener('click', async () => {
        if (!currentDetailListingId) return;

        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        listingDetailBuyBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/api/listings/${currentDetailListingId}/buy`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });

            const data = await res.json();

            if (!data.ok) {
                alert(data.error || 'Не удалось купить лот');
                listingDetailBuyBtn.disabled = false;
                return;
            }

            updateBalanceUI(data.balance);
            alert('Покупка успешна!');
            listingDetailModal.style.display = 'none';
            currentDetailListingId = null;
            await loadListings();
        } catch (err) {
            alert('Ошибка соединения с сервером');
            console.error(err);
        } finally {
            listingDetailBuyBtn.disabled = false;
        }
    });
}

// =====================================================================
// ПОИСК И СОРТИРОВКА
// =====================================================================

let searchDebounceTimer = null;
searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(loadListings, 300);
});

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
        activeFilters.sort = li.getAttribute('data-sort');
        sortModal.classList.remove('active');
        loadListings();
    });
});

// =====================================================================
// ИНИЦИАЛИЗАЦИЯ МАРКЕТА
// =====================================================================

(async function initMarket() {
    grid.innerHTML = `<div class="empty-state">Загрузка...</div>`;
    await Promise.all([loadCollections(), loadTraits()]);
    await loadListings();
})();

// Инициализация TonConnect UI
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://holdenholden72-dotcom.github.io/BoomMarket/tonconnect-manifest.json',
    buttonRootId: 'walletBtn'
});

// === Telegram WebApp + авторизация через бэкенд по JWT ===
const tg = window.Telegram?.WebApp;

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

// Проверяет, что сумма — "круглое" число в заданном диапазоне с не более чем
// одним знаком после запятой (0.2, 1.4, 10.7, 10 — можно; 1.76, 9.87 — нельзя).
function isValidAmount(amount, min = 0.1, max = 100000) {
    if (isNaN(amount) || !isFinite(amount)) return false;
    if (amount < min || amount > max) return false;
    // Приводим к десятым и сравниваем — так надёжнее плавающей точки.
    const tenths = Math.round(amount * 10);
    return Math.abs(tenths - amount * 10) < 1e-6 || Math.abs(tenths / 10 - amount) < 1e-9;
}

const withdrawModal = document.getElementById('withdrawModal');
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');

if (confirmWithdrawBtn) {
    confirmWithdrawBtn.addEventListener('click', async () => {
        const amount = parseFloat(withdrawAmountInput.value);

        if (!isValidAmount(amount, 0.5, 100000)) {
            alert('Сумма должна быть от 0.5 до 100000, максимум с одним знаком после запятой (например: 0.5, 1.4, 10.7, 10)');
            return;
        }
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

        if (!isValidAmount(amount)) {
            alert('Сумма должна быть от 0.1 до 100000, максимум с одним знаком после запятой (например: 0.2, 1.4, 10.7, 10)');
            return;
        }

        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

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

// === БЛОК ВЫСТАВЛЕНИЯ NFT НА ПРОДАЖУ ===
const createListingModal = document.getElementById('createListingModal');
const addListingBtn = document.getElementById('addListingBtn');
const closeCreateListingModalBtn = document.getElementById('closeCreateListingModal');
const listingCollectionSelect = document.getElementById('listingCollectionSelect');
const listingModelSelect = document.getElementById('listingModelSelect');
const listingBackdropSelect = document.getElementById('listingBackdropSelect');
const listingSymbolSelect = document.getElementById('listingSymbolSelect');
const listingGiftNumberInput = document.getElementById('listingGiftNumber');
const listingPriceInput = document.getElementById('listingPrice');
const confirmCreateListingBtn = document.getElementById('confirmCreateListingBtn');

// Полные трейты (с id!) для ВЫБРАННОЙ в форме коллекции — отдельный кэш от
// traitsCache фильтров маркета, потому что здесь нужны именно id для отправки на сервер.
let listingTraitsCache = { models: [], backdrops: [], symbols: [] };

function fillListingSelect(selectEl, items, placeholder, labelFn) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = labelFn(item);
        selectEl.appendChild(opt);
    });
    selectEl.disabled = items.length === 0;
}

function resetListingForm() {
    listingCollectionSelect.value = '';
    listingModelSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    listingBackdropSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    listingSymbolSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    listingModelSelect.disabled = true;
    listingBackdropSelect.disabled = true;
    listingSymbolSelect.disabled = true;
    listingGiftNumberInput.value = '';
    listingPriceInput.value = '';
    listingTraitsCache = { models: [], backdrops: [], symbols: [] };
}

async function populateListingCollectionSelect() {
    // Коллекции уже загружены маркетом в collectionsCache при старте —
    // переиспользуем, чтобы не дёргать сервер второй раз.
    listingCollectionSelect.innerHTML = '<option value="">Выберите коллекцию</option>';
    collectionsCache.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        listingCollectionSelect.appendChild(opt);
    });
}

if (addListingBtn && createListingModal) {
    addListingBtn.addEventListener('click', async () => {
        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }
        resetListingForm();
        await populateListingCollectionSelect();
        createListingModal.style.display = 'flex';
    });
}

if (closeCreateListingModalBtn && createListingModal) {
    closeCreateListingModalBtn.addEventListener('click', () => {
        createListingModal.style.display = 'none';
    });
}

// При выборе коллекции — подгружаем её реальные модели/фоны/символы (с id)
// через /api/collections/:id/filters и заполняем остальные select'ы.
listingCollectionSelect.addEventListener('change', async () => {
    const collectionId = listingCollectionSelect.value;

    if (!collectionId) {
        listingModelSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        listingBackdropSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        listingSymbolSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        listingModelSelect.disabled = true;
        listingBackdropSelect.disabled = true;
        listingSymbolSelect.disabled = true;
        return;
    }

    listingModelSelect.innerHTML = '<option value="">Загрузка...</option>';
    listingBackdropSelect.innerHTML = '<option value="">Загрузка...</option>';
    listingSymbolSelect.innerHTML = '<option value="">Загрузка...</option>';

    try {
        const res = await fetch(`${API_URL}/api/collections/${collectionId}/filters`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || 'Не удалось загрузить трейты');

        listingTraitsCache = data.filters;

        fillListingSelect(listingModelSelect, listingTraitsCache.models, 'Выберите модель', m =>
            m.rarity_permille != null ? `${m.name} (${m.rarity_permille}%)` : m.name);
        fillListingSelect(listingBackdropSelect, listingTraitsCache.backdrops, 'Выберите фон', b =>
            b.rarity_permille != null ? `${b.name} (${b.rarity_permille}%)` : b.name);
        fillListingSelect(listingSymbolSelect, listingTraitsCache.symbols, 'Выберите символ', s =>
            s.rarity_permille != null ? `${s.name} (${s.rarity_permille}%)` : s.name);
    } catch (e) {
        console.error('Не удалось загрузить трейты коллекции:', e);
        listingModelSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        listingBackdropSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        listingSymbolSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
});

if (confirmCreateListingBtn) {
    confirmCreateListingBtn.addEventListener('click', async () => {
        const collectionId = parseInt(listingCollectionSelect.value, 10);
        const modelId = parseInt(listingModelSelect.value, 10);
        const backdropId = parseInt(listingBackdropSelect.value, 10);
        const symbolId = parseInt(listingSymbolSelect.value, 10);
        const giftNumber = parseInt(listingGiftNumberInput.value, 10);
        const price = parseFloat(listingPriceInput.value);

        if (!collectionId) {
            alert('Выберите коллекцию');
            return;
        }
        if (!modelId) {
            alert('Выберите модель');
            return;
        }
        if (!backdropId) {
            alert('Выберите фон');
            return;
        }
        if (!symbolId) {
            alert('Выберите символ');
            return;
        }
        if (!giftNumber || giftNumber <= 0) {
            alert('Укажите корректный номер подарка');
            return;
        }
        if (!price || price <= 0) {
            alert('Укажите корректную цену');
            return;
        }
        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/listings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ collectionId, modelId, backdropId, symbolId, giftNumber, price }),
            });

            const data = await res.json();

            if (!data.ok) {
                alert(data.error || 'Не удалось выставить лот');
                return;
            }

            alert('NFT выставлен на продажу!');
            createListingModal.style.display = 'none';
            resetListingForm();

            // Возвращаемся на маркет и обновляем список — новый лот должен появиться сразу.
            profileScreen.classList.remove('active');
            marketScreen.classList.add('active');
            await loadListings();
        } catch (e) {
            alert('Ошибка соединения с сервером');
            console.error(e);
        }
    });
}
