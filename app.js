// === Адрес бэкенда на Railway ===
const API_URL = 'https://boom-backend-production-dc56.up.railway.app';

const grid = document.getElementById('marketGrid');
const searchInput = document.getElementById('searchInput');
const sortTriggerBtn = document.getElementById('sortTriggerBtn');
const sortModal = document.getElementById('sortModal');

// Элементы для переключения экранов
const marketScreen = document.getElementById('marketScreen');
const profileScreen = document.getElementById('profileScreen');
const historyScreen = document.getElementById('historyScreen');
const ordersScreen = document.getElementById('ordersScreen');
const openProfileBtn = document.getElementById('openProfileBtn');
const backToMarketBtn = document.getElementById('backToMarketBtn');
const backToProfileFromHistoryBtn = document.getElementById('backToProfileFromHistoryBtn');
const backToProfileFromOrdersBtn = document.getElementById('backToProfileFromOrdersBtn');

const screensByName = {
    market: marketScreen,
    profile: profileScreen,
    history: historyScreen,
    orders: ordersScreen,
};

/** Показывает один экран из screensByName, скрывая остальные, и подсвечивает
 * соответствующий пункт во всех копиях нижней навигации (она есть на нескольких экранах). */
function showScreen(name) {
    Object.values(screensByName).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (screensByName[name]) screensByName[name].classList.add('active');

    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-nav') === name);
    });

    if (name === 'history') {
        loadHistory();
    }
    if (name === 'orders') {
        loadActiveOrders();
        loadOrderHistory();
    }
}

openProfileBtn.addEventListener('click', () => {
    showScreen('profile');
});

backToMarketBtn.addEventListener('click', () => {
    showScreen('market');
});

if (backToProfileFromHistoryBtn) {
    backToProfileFromHistoryBtn.addEventListener('click', () => {
        showScreen('profile');
    });
}

if (backToProfileFromOrdersBtn) {
    backToProfileFromOrdersBtn.addEventListener('click', () => {
        showScreen('profile');
    });
}

// Нижняя навигация встречается на нескольких экранах (профиль, история) —
// делегируем клики по data-nav вместо привязки к id конкретной кнопки.
document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
        showScreen(btn.getAttribute('data-nav'));
    });
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
                    <div class="nft-actions">
                        <button class="order-quick-btn" data-listing-id="${item.id}" title="Создать ордер на этот трейт">🧾</button>
                        <button class="cart-btn" data-listing-id="${item.id}">🛒</button>
                    </div>
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
    const cartBtn = e.target.closest('.cart-btn');
    if (cartBtn) {
        const item = listingsById.get(cartBtn.dataset.listingId);
        if (item) openListingDetail(item);
        return;
    }

    const orderBtn = e.target.closest('.order-quick-btn');
    if (orderBtn) {
        const item = listingsById.get(orderBtn.dataset.listingId);
        if (item) {
            openCreateOrderModal({
                collectionId: item.collection_id,
                modelId: item.model_id,
                backdropId: item.backdrop_id,
                symbolId: item.symbol_id,
            });
        }
        return;
    }
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
// ИСТОРИЯ ОПЕРАЦИЙ
// =====================================================================

const historyList = document.getElementById('historyList');
const historyById = new Map(); // кэш загруженной истории по id — для детальной карточки

const historyTypeLabels = {
    deposit: 'Пополнение баланса',
    withdraw: 'Вывод средств',
    buy: 'Покупка NFT',
    sell: 'Продажа NFT',
};

const historyTypeIcons = {
    deposit: '➕',
    withdraw: '➖',
};

/** Сервер отдаёт время в UTC как "YYYY-MM-DD HH:MM:SS" (SQLite datetime('now')) —
 * добавляем "T"/"Z", чтобы Date() распознал строку как UTC, а не как локальное время. */
function formatHistoryDate(isoString) {
    if (!isoString) return '';
    const iso = isoString.includes('T') ? isoString : isoString.replace(' ', 'T') + 'Z';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return isoString;

    const datePart = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} · ${timePart}`;
}

function formatAmount(amount) {
    const sign = amount > 0 ? '+' : '';
    return `${sign}${amount} 💎`;
}

function renderHistoryList(items) {
    historyList.innerHTML = '';
    historyById.clear();

    if (!items || items.length === 0) {
        historyList.innerHTML = `<div class="empty-state">Пока нет операций</div>`;
        return;
    }

    items.forEach(item => {
        historyById.set(String(item.id), item);

        // "Картинка подарка" и клик на полную карточку доступны только для покупок/продаж —
        // у пополнения/вывода нет привязанного NFT.
        const isGift = item.type === 'buy' || item.type === 'sell';

        const li = document.createElement('li');
        li.className = 'history-row' + (isGift ? ' has-gift' : '');
        if (isGift) li.dataset.historyId = item.id;

        let thumbHtml;
        if (isGift) {
            const image = item.model_image || item.collection_image || '';
            const bg = item.backdrop_color || '#333';
            thumbHtml = `
                <div class="history-thumb" style="background-color:${bg};">
                    ${image ? `<img src="${image}" alt="">` : ''}
                </div>`;
        } else {
            thumbHtml = `<div class="history-thumb is-icon">${historyTypeIcons[item.type] || '💎'}</div>`;
        }

        const title = isGift ? item.collection_name : (historyTypeLabels[item.type] || item.type);
        const metaParts = [];
        if (isGift && item.gift_number) metaParts.push(`#${item.gift_number}`);
        metaParts.push(formatHistoryDate(item.created_at));

        const amountClass = item.amount >= 0 ? 'positive' : 'negative';

        li.innerHTML = `
            ${thumbHtml}
            <div class="history-info">
                <div class="history-name">${title}</div>
                <div class="history-meta">${metaParts.join(' · ')}</div>
            </div>
            <div class="history-amount ${amountClass}">${formatAmount(item.amount)}</div>
        `;

        historyList.appendChild(li);
    });
}

async function loadHistory() {
    if (!historyList) return;

    if (!authToken) {
        historyList.innerHTML = `<div class="empty-state">Не удалось подтвердить личность. Попробуйте перезайти.</div>`;
        return;
    }

    historyList.innerHTML = `<div class="empty-state">Загрузка...</div>`;

    try {
        const res = await fetch(`${API_URL}/api/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();

        if (!data.ok) {
            historyList.innerHTML = `<div class="empty-state">${data.error || 'Не удалось загрузить историю'}</div>`;
            return;
        }

        renderHistoryList(data.history);
    } catch (e) {
        historyList.innerHTML = `<div class="empty-state">Ошибка соединения с сервером</div>`;
        console.error(e);
    }
}

// === Детальная карточка операции (открывается по клику на картинку подарка) ===
const historyDetailModal = document.getElementById('historyDetailModal');
const closeHistoryDetailBtn = document.getElementById('closeHistoryDetail');
const historyDetailImageWrap = document.getElementById('historyDetailImageWrap');
const historyDetailImage = document.getElementById('historyDetailImage');
const historyDetailTitle = document.getElementById('historyDetailTitle');
const historyDetailNumber = document.getElementById('historyDetailNumber');
const historyDetailCollection = document.getElementById('historyDetailCollection');
const historyDetailModelEl = document.getElementById('historyDetailModel');
const historyDetailBackdrop = document.getElementById('historyDetailBackdrop');
const historyDetailSymbol = document.getElementById('historyDetailSymbol');
const historyDetailType = document.getElementById('historyDetailType');
const historyDetailDate = document.getElementById('historyDetailDate');
const historyDetailAmount = document.getElementById('historyDetailAmount');

function openHistoryDetail(item) {
    const image = item.model_image || item.collection_image || '';
    historyDetailImageWrap.style.backgroundColor = item.backdrop_color || '#333';
    historyDetailImage.src = image;
    historyDetailTitle.textContent = item.collection_name;
    historyDetailNumber.textContent = item.gift_number ? `#${item.gift_number}` : '';
    historyDetailCollection.textContent = item.collection_name || '—';
    historyDetailModelEl.textContent = traitLabel(item.model_name);
    historyDetailBackdrop.textContent = traitLabel(item.backdrop_name);
    historyDetailSymbol.textContent = traitLabel(item.symbol_name);
    historyDetailType.textContent = historyTypeLabels[item.type] || item.type;
    historyDetailDate.textContent = formatHistoryDate(item.created_at);

    const amountClass = item.amount >= 0 ? 'positive' : 'negative';
    historyDetailAmount.className = `history-detail-amount ${amountClass}`;
    historyDetailAmount.textContent = formatAmount(item.amount);

    historyDetailModal.style.display = 'flex';
}

if (historyList) {
    historyList.addEventListener('click', (e) => {
        const row = e.target.closest('.history-row.has-gift');
        if (!row) return;
        const item = historyById.get(row.dataset.historyId);
        if (!item) return;
        openHistoryDetail(item);
    });
}

if (closeHistoryDetailBtn && historyDetailModal) {
    closeHistoryDetailBtn.addEventListener('click', () => {
        historyDetailModal.style.display = 'none';
    });
}

// =====================================================================
// ОРДЕРА НА ПОКУПКУ
// =====================================================================

const ordersActiveList = document.getElementById('ordersActiveList');
const ordersHistoryList = document.getElementById('ordersHistoryList');
const ordersTabs = document.getElementById('ordersTabs');

const ordersActiveById = new Map();
const ordersHistoryById = new Map();

const orderStatusLabels = {
    active: 'Активен',
    filled: 'Исполнен',
    cancelled: 'Отменён',
};

/** Короткое описание запрошенных трейтов ордера — пустое поле в БД значит "любой". */
function orderCriteriaLabel(item) {
    const parts = [];
    parts.push(item.model_name ? item.model_name : 'Любая модель');
    parts.push(item.backdrop_name ? item.backdrop_name : 'Любой фон');
    parts.push(item.symbol_name ? item.symbol_name : 'Любой символ');
    return parts.join(' · ');
}

function renderOrdersList(container, cacheMap, items, { showCancel }) {
    container.innerHTML = '';
    cacheMap.clear();

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state">${showCancel ? 'Нет активных ордеров' : 'История ордеров пуста'}</div>`;
        return;
    }

    items.forEach(item => {
        cacheMap.set(String(item.id), item);

        const image = item.model_image || item.collection_image || '';
        const bg = item.backdrop_color || '#333';

        const li = document.createElement('li');
        li.className = 'history-row has-gift';
        li.dataset.orderId = item.id;

        const displayPrice = (item.status === 'filled' && item.matched_price != null) ? item.matched_price : item.max_price;

        const rightHtml = showCancel
            ? `<div class="order-row-price">
                   <span>💎 ${displayPrice}</span>
                   <button class="order-row-cancel" data-cancel-order-id="${item.id}">Отменить</button>
               </div>`
            : `<div class="order-row-price">
                   <span>💎 ${displayPrice}</span>
                   <span class="order-row-status is-${item.status}">${orderStatusLabels[item.status] || item.status}</span>
               </div>`;

        li.innerHTML = `
            <div class="history-thumb" style="background-color:${bg};">
                ${image ? `<img src="${image}" alt="">` : ''}
            </div>
            <div class="history-info">
                <div class="history-name">${item.collection_name}</div>
                <div class="history-meta">${orderCriteriaLabel(item)}</div>
                <div class="history-meta">${formatHistoryDate(item.created_at)}</div>
            </div>
            ${rightHtml}
        `;

        container.appendChild(li);
    });
}

async function loadActiveOrders() {
    if (!ordersActiveList) return;
    if (!authToken) {
        ordersActiveList.innerHTML = `<div class="empty-state">Не удалось подтвердить личность. Попробуйте перезайти.</div>`;
        return;
    }
    ordersActiveList.innerHTML = `<div class="empty-state">Загрузка...</div>`;
    try {
        const res = await fetch(`${API_URL}/api/orders`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        if (!data.ok) {
            ordersActiveList.innerHTML = `<div class="empty-state">${data.error || 'Не удалось загрузить ордера'}</div>`;
            return;
        }
        renderOrdersList(ordersActiveList, ordersActiveById, data.orders, { showCancel: true });
    } catch (e) {
        ordersActiveList.innerHTML = `<div class="empty-state">Ошибка соединения с сервером</div>`;
        console.error(e);
    }
}

async function loadOrderHistory() {
    if (!ordersHistoryList) return;
    if (!authToken) {
        ordersHistoryList.innerHTML = `<div class="empty-state">Не удалось подтвердить личность. Попробуйте перезайти.</div>`;
        return;
    }
    ordersHistoryList.innerHTML = `<div class="empty-state">Загрузка...</div>`;
    try {
        const res = await fetch(`${API_URL}/api/orders/history`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        if (!data.ok) {
            ordersHistoryList.innerHTML = `<div class="empty-state">${data.error || 'Не удалось загрузить историю ордеров'}</div>`;
            return;
        }
        renderOrdersList(ordersHistoryList, ordersHistoryById, data.orders, { showCancel: false });
    } catch (e) {
        ordersHistoryList.innerHTML = `<div class="empty-state">Ошибка соединения с сервером</div>`;
        console.error(e);
    }
}

// === Переключение вкладок "Активные" / "История" ===
if (ordersTabs) {
    ordersTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.orders-tab');
        if (!btn) return;

        const tab = btn.getAttribute('data-orders-tab');
        ordersTabs.querySelectorAll('.orders-tab').forEach(t => t.classList.toggle('active', t === btn));
        ordersActiveList.style.display = tab === 'active' ? '' : 'none';
        ordersHistoryList.style.display = tab === 'history' ? '' : 'none';
    });
}

// === Детальная карточка ордера (открывается по клику на аватарку/строку, в т.ч. в истории) ===
const orderDetailModal = document.getElementById('orderDetailModal');
const closeOrderDetailBtn = document.getElementById('closeOrderDetail');
const orderDetailImageWrap = document.getElementById('orderDetailImageWrap');
const orderDetailImage = document.getElementById('orderDetailImage');
const orderDetailTitle = document.getElementById('orderDetailTitle');
const orderDetailNumber = document.getElementById('orderDetailNumber');
const orderDetailCollection = document.getElementById('orderDetailCollection');
const orderDetailModelEl = document.getElementById('orderDetailModel');
const orderDetailBackdrop = document.getElementById('orderDetailBackdrop');
const orderDetailSymbol = document.getElementById('orderDetailSymbol');
const orderDetailPrice = document.getElementById('orderDetailPrice');
const orderDetailStatus = document.getElementById('orderDetailStatus');
const orderDetailCreated = document.getElementById('orderDetailCreated');
const orderDetailClosedRow = document.getElementById('orderDetailClosedRow');
const orderDetailClosedLabel = document.getElementById('orderDetailClosedLabel');
const orderDetailClosed = document.getElementById('orderDetailClosed');
const orderDetailCancelBtn = document.getElementById('orderDetailCancelBtn');

let currentDetailOrderId = null;

function openOrderDetail(item) {
    currentDetailOrderId = item.id;

    const image = item.model_image || item.collection_image || '';
    orderDetailImageWrap.style.backgroundColor = item.backdrop_color || '#333';
    orderDetailImage.src = image;
    orderDetailTitle.textContent = item.collection_name;
    orderDetailNumber.textContent = (item.status === 'filled' && item.matched_gift_number) ? `#${item.matched_gift_number}` : '';
    orderDetailCollection.textContent = item.collection_name || '—';
    orderDetailModelEl.textContent = traitLabel(item.model_name) === '—' ? 'Любая' : item.model_name;
    orderDetailBackdrop.textContent = traitLabel(item.backdrop_name) === '—' ? 'Любой' : item.backdrop_name;
    orderDetailSymbol.textContent = traitLabel(item.symbol_name) === '—' ? 'Любой' : item.symbol_name;

    const displayPrice = (item.status === 'filled' && item.matched_price != null) ? item.matched_price : item.max_price;
    orderDetailPrice.textContent = `💎 ${displayPrice}`;
    orderDetailStatus.textContent = orderStatusLabels[item.status] || item.status;

    orderDetailCreated.textContent = formatHistoryDate(item.created_at);

    if (item.status === 'active') {
        orderDetailClosedRow.style.display = 'none';
        orderDetailCancelBtn.style.display = '';
    } else {
        orderDetailClosedRow.style.display = '';
        orderDetailClosedLabel.textContent = item.status === 'filled' ? 'Исполнен' : 'Отменён';
        orderDetailClosed.textContent = formatHistoryDate(item.closed_at);
        orderDetailCancelBtn.style.display = 'none';
    }

    orderDetailModal.style.display = 'flex';
}

async function cancelOrder(orderId) {
    if (!authToken) {
        alert('Не удалось подтвердить личность. Попробуйте перезайти.');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!data.ok) {
            alert(data.error || 'Не удалось отменить ордер');
            return;
        }
        updateBalanceUI(data.balance);
        await loadActiveOrders();
        await loadOrderHistory();
    } catch (e) {
        alert('Ошибка соединения с сервером');
        console.error(e);
    }
}

function bindOrdersListClicks(container, cacheMap) {
    if (!container) return;
    container.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('.order-row-cancel');
        if (cancelBtn) {
            cancelOrder(cancelBtn.dataset.cancelOrderId);
            return;
        }
        const row = e.target.closest('.history-row[data-order-id]');
        if (!row) return;
        const item = cacheMap.get(row.dataset.orderId);
        if (!item) return;
        openOrderDetail(item);
    });
}

bindOrdersListClicks(ordersActiveList, ordersActiveById);
bindOrdersListClicks(ordersHistoryList, ordersHistoryById);

if (closeOrderDetailBtn && orderDetailModal) {
    closeOrderDetailBtn.addEventListener('click', () => {
        orderDetailModal.style.display = 'none';
        currentDetailOrderId = null;
    });
}

if (orderDetailCancelBtn) {
    orderDetailCancelBtn.addEventListener('click', async () => {
        if (!currentDetailOrderId) return;
        await cancelOrder(currentDetailOrderId);
        orderDetailModal.style.display = 'none';
        currentDetailOrderId = null;
    });
}

// === Модалка создания ордера ===
const createOrderModal = document.getElementById('createOrderModal');
const openCreateOrderBtn = document.getElementById('openCreateOrderBtn');
const closeCreateOrderModalBtn = document.getElementById('closeCreateOrderModal');
const orderCollectionSelect = document.getElementById('orderCollectionSelect');
const orderModelSelect = document.getElementById('orderModelSelect');
const orderBackdropSelect = document.getElementById('orderBackdropSelect');
const orderSymbolSelect = document.getElementById('orderSymbolSelect');
const orderMaxPriceInput = document.getElementById('orderMaxPrice');
const confirmCreateOrderBtn = document.getElementById('confirmCreateOrderBtn');

let orderTraitsCache = { models: [], backdrops: [], symbols: [] };

function resetOrderForm() {
    orderCollectionSelect.value = '';
    orderModelSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    orderBackdropSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    orderSymbolSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
    orderModelSelect.disabled = true;
    orderBackdropSelect.disabled = true;
    orderSymbolSelect.disabled = true;
    orderMaxPriceInput.value = '';
    orderTraitsCache = { models: [], backdrops: [], symbols: [] };
}

async function populateOrderCollectionSelect() {
    orderCollectionSelect.innerHTML = '<option value="">Выберите коллекцию</option>';
    collectionsCache.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        orderCollectionSelect.appendChild(opt);
    });
}

// Подгружает трейты (с id) выбранной коллекции в селекты модалки ордера;
// вынесено в отдельную функцию, чтобы вызывать и из события change, и
// программно — при открытии модалки с предзаполненным трейтом с карточки.
async function loadOrderTraitsForCollection(collectionId) {
    orderModelSelect.innerHTML = '<option value="">Загрузка...</option>';
    orderBackdropSelect.innerHTML = '<option value="">Загрузка...</option>';
    orderSymbolSelect.innerHTML = '<option value="">Загрузка...</option>';

    try {
        const res = await fetch(`${API_URL}/api/collections/${collectionId}/filters`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Не удалось загрузить трейты');

        orderTraitsCache = data.filters;

        fillListingSelect(orderModelSelect, orderTraitsCache.models, 'Любая модель', m =>
            m.rarity_permille != null ? `${m.name} (${m.rarity_permille}%)` : m.name);
        fillListingSelect(orderBackdropSelect, orderTraitsCache.backdrops, 'Любой фон', b =>
            b.rarity_permille != null ? `${b.name} (${b.rarity_permille}%)` : b.name);
        fillListingSelect(orderSymbolSelect, orderTraitsCache.symbols, 'Любой символ', s =>
            s.rarity_permille != null ? `${s.name} (${s.rarity_permille}%)` : s.name);

        // В отличие от формы выставления лота, здесь трейты не обязательны —
        // "Любая/Любой" остаётся доступным вариантом, поэтому селект не блокируем.
        orderModelSelect.disabled = false;
        orderBackdropSelect.disabled = false;
        orderSymbolSelect.disabled = false;
    } catch (e) {
        console.error('Не удалось загрузить трейты коллекции:', e);
        orderModelSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        orderBackdropSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        orderSymbolSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Открывает модалку создания ордера. Если передан preset ({collectionId,
// modelId, backdropId, symbolId}) — сразу подгружает трейты этой коллекции
// и выставляет конкретные модель/фон/символ (используется кнопкой 🧾 на
// карточке маркета — "создать ордер именно на этот трейт").
async function openCreateOrderModal(preset = null) {
    if (!authToken) {
        alert('Не удалось подтвердить личность. Попробуйте перезайти.');
        return;
    }

    resetOrderForm();
    await populateOrderCollectionSelect();

    if (preset && preset.collectionId) {
        orderCollectionSelect.value = String(preset.collectionId);
        await loadOrderTraitsForCollection(preset.collectionId);
        if (preset.modelId) orderModelSelect.value = String(preset.modelId);
        if (preset.backdropId) orderBackdropSelect.value = String(preset.backdropId);
        if (preset.symbolId) orderSymbolSelect.value = String(preset.symbolId);
    }

    createOrderModal.style.display = 'flex';
}

if (openCreateOrderBtn && createOrderModal) {
    openCreateOrderBtn.addEventListener('click', () => openCreateOrderModal());
}

if (closeCreateOrderModalBtn && createOrderModal) {
    closeCreateOrderModalBtn.addEventListener('click', () => {
        createOrderModal.style.display = 'none';
    });
}

// При ручном выборе коллекции в модалке — подгружаем её трейты.
orderCollectionSelect.addEventListener('change', async () => {
    const collectionId = orderCollectionSelect.value;

    if (!collectionId) {
        orderModelSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        orderBackdropSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        orderSymbolSelect.innerHTML = '<option value="">Сначала выберите коллекцию</option>';
        orderModelSelect.disabled = true;
        orderBackdropSelect.disabled = true;
        orderSymbolSelect.disabled = true;
        return;
    }

    await loadOrderTraitsForCollection(collectionId);
});

if (confirmCreateOrderBtn) {
    confirmCreateOrderBtn.addEventListener('click', async () => {
        const collectionId = parseInt(orderCollectionSelect.value, 10);
        const modelId = orderModelSelect.value ? parseInt(orderModelSelect.value, 10) : null;
        const backdropId = orderBackdropSelect.value ? parseInt(orderBackdropSelect.value, 10) : null;
        const symbolId = orderSymbolSelect.value ? parseInt(orderSymbolSelect.value, 10) : null;
        const maxPrice = parseFloat(orderMaxPriceInput.value);

        if (!collectionId) {
            alert('Выберите коллекцию');
            return;
        }
        if (!maxPrice || maxPrice <= 0) {
            alert('Укажите корректную цену');
            return;
        }
        if (!authToken) {
            alert('Не удалось подтвердить личность. Попробуйте перезайти.');
            return;
        }

        confirmCreateOrderBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ collectionId, modelId, backdropId, symbolId, maxPrice }),
            });

            const data = await res.json();

            if (!data.ok) {
                alert(data.error || 'Не удалось создать ордер');
                return;
            }

            updateBalanceUI(data.balance);
            alert('Ордер создан!');
            createOrderModal.style.display = 'none';
            resetOrderForm();

            await loadActiveOrders();
        } catch (e) {
            alert('Ошибка соединения с сервером');
            console.error(e);
        } finally {
            confirmCreateOrderBtn.disabled = false;
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

const closeSortModalBtn = document.getElementById('closeSortModal');
const sortList = document.getElementById('sortList');
const sortResetBtn = document.getElementById('sortReset');
const sortApplyBtn = document.getElementById('sortApply');
const sortRows = Array.from(sortList.querySelectorAll('.filter-picker-row'));

// Черновой выбор сортировки — применяется только по кнопке "Показать результаты",
// отменяется при закрытии крестиком (как и в filterPickerModal).
// Сортировка по смыслу может быть только одна, поэтому выбор нового варианта
// снимает предыдущий — но визуально это те же квадратики-чекбоксы, что и в фильтрах.
let draftSort = activeFilters.sort;

function renderSortList() {
    sortRows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        const isChecked = row.getAttribute('data-sort') === draftSort;
        checkbox.checked = isChecked;
        row.classList.toggle('is-selected', isChecked);
    });
}

sortRows.forEach(row => {
    row.addEventListener('click', (e) => {
        const value = row.getAttribute('data-sort');
        draftSort = (draftSort === value) ? null : value;
        renderSortList();
    });
});

sortTriggerBtn.addEventListener('click', () => {
    draftSort = activeFilters.sort;
    renderSortList();
    sortModal.classList.add('active');
});

if (closeSortModalBtn) {
    closeSortModalBtn.addEventListener('click', () => {
        sortModal.classList.remove('active');
    });
}

sortModal.addEventListener('click', (e) => {
    if (e.target === sortModal) {
        sortModal.classList.remove('active');
    }
});

if (sortResetBtn) {
    sortResetBtn.addEventListener('click', () => {
        draftSort = null;
        renderSortList();
    });
}

if (sortApplyBtn) {
    sortApplyBtn.addEventListener('click', () => {
        activeFilters.sort = draftSort;
        sortModal.classList.remove('active');
        loadListings();
    });
}

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
            showScreen('market');
            await loadListings();
        } catch (e) {
            alert('Ошибка соединения с сервером');
            console.error(e);
        }
    });
}
