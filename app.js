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
// Открытие профиля по клику на аватарку или блок профиля
const userProfileBlock = document.querySelector('.user-profile');

if (userProfileBlock && profileScreen && marketScreen) {
    userProfileBlock.addEventListener('click', () => {
        marketScreen.classList.remove('active');
        profileScreen.classList.add('active');
    });
}
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

const sortItems = document.querySelectorAll('.sort-content li');

sortItems.forEach(li => {
    li.addEventListener('click', () => {
        sortItems.forEach(item => item.classList.remove('active'));
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
// Элементы сортировки инвентаря
const inventorySortTriggerBtn = document.getElementById('inventorySortTriggerBtn');
const inventorySortModal = document.getElementById('inventorySortModal');
const inventorySortItems = inventorySortModal.querySelectorAll('.sort-content li');

// Открытие модалки сортировки инвентаря
inventorySortTriggerBtn.addEventListener('click', () => {
    inventorySortModal.classList.toggle('active');
});

// Закрытие при клике вне окна
inventorySortModal.addEventListener('click', (e) => {
    if (e.target === inventorySortModal) {
        inventorySortModal.classList.remove('active');
    }
});

// Логика выбора пункта сортировки с желтыми кружками
inventorySortItems.forEach(li => {
    li.addEventListener('click', () => {
        inventorySortItems.forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        
        inventorySortModal.classList.remove('active');
    });
});
// Нижняя навигация: переключение экранов
const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
if (bottomNavItems.length > 0) {
    bottomNavItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Индекс 4 — это последняя кнопка "Хранилище"
            if (index === 4) {
                marketScreen.classList.remove('active');
                profileScreen.classList.add('active');
            } 
            // Индекс 0 — первая кнопка "Маркет"
            else if (index === 0) {
                profileScreen.classList.remove('active');
                marketScreen.classList.add('active');
            }
        });
    });
}