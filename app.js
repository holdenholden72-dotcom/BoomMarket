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
        // Сначала убираем класс active у абсолютно всех пунктов
        document.querySelectorAll('.sort-content li').forEach(el => el.classList.remove('active'));
        
        // Затем добавляем active только на тот пункт, на который нажали
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

// Автоматическая загрузка аватарки из Telegram
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    if (tgUser.photo_url) {
        const avatarElement = document.getElementById('openProfileBtn');
        if (avatarElement) {
            // Если элемент стал тегом <img>, меняем src
            avatarElement.src = tgUser.photo_url;
        }
    }
}
// === ПОИСК БАЛАНСА НА СТРАНИЦЕ (должен быть выше всех функций) ===
const userBalanceElements = document.querySelectorAll('.user-balance');

// === БЛОК ВЫВОДА СРЕДСТВ ===
const withdrawModal = document.getElementById('withdrawModal');
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');
const withdrawAmountInput = document.getElementById('withdrawAmount');

if (confirmWithdrawBtn) {
    confirmWithdrawBtn.addEventListener('click', () => {
        const amount = parseFloat(withdrawAmountInput.value);
        
        // 1. Проверяем, введено ли число больше нуля
        if (isNaN(amount) || amount <= 0) {
            alert('Введите корректную сумму для вывода!');
            return;
        }

        // 2. Берем текущий баланс
        let currentBalance = parseFloat(localStorage.getItem('userBalance')) || 100;

        // 3. Проверяем, хватает ли средств
        if (amount > currentBalance) {
            alert('Недостаточно средств на балансе!');
            return;
        }

        // 4. Списываем средства и сохраняем
        currentBalance -= amount;
        localStorage.setItem('userBalance', currentBalance);

        // Обновляем баланс на экране
        userBalanceElements.forEach(el => {
            el.textContent = currentBalance;
        });

        alert(`Запрос на вывод ${amount} успешно создан!`);
        withdrawModal.style.display = 'none';
        withdrawAmountInput.value = '';
    });
}
// === БЛОК ПОПОЛНЕНИЯ СРЕДСТВ ===
const depositModal = document.getElementById('depositModal');
const plusDepositBtn = document.getElementById('plusDepositBtn');
const quickDepositBtn = document.getElementById('quickDepositBtn');
const closeDepositModalBtn = document.getElementById('closeDepositModal');
const confirmDepositBtn = document.getElementById('confirmDepositBtn');
const depositAmountInput = document.getElementById('depositAmount');

const openDeposit = () => {
    // 1. Сначала находим кнопку профиля или экран профиля и активируем его
    const profileScreen = document.getElementById('profileScreen');
    const marketScreen = document.getElementById('marketScreen');
    
    if (profileScreen && marketScreen) {
        marketScreen.classList.remove('active');
        profileScreen.classList.add('active');
    }

    // 2. Затем открываем модальное окно пополнения
    if (depositModal) {
        depositModal.style.display = 'flex';
    }
};

if (plusDepositBtn) plusDepositBtn.addEventListener('click', openDeposit);
if (quickDepositBtn) quickDepositBtn.addEventListener('click', () => {
    if (depositModal) depositModal.style.display = 'flex';
});
if (confirmDepositBtn) {
    confirmDepositBtn.addEventListener('click', () => {
        const amount = parseFloat(depositAmountInput.value);

        if (isNaN(amount) || amount < 0.01) {
            alert('Минимальная сумма для пополнения: 0.01');
            return;
        }

        // Берем текущий баланс из первого найденного элемента
        let currentBalance = 0;
        if (userBalanceElements.length > 0) {
            currentBalance = parseFloat(userBalanceElements[0].innerText) || 0;
        }
        
        currentBalance += amount;
        
        // Обновляем баланс во ВСЕХ элементах с классом .user-balance
        userBalanceElements.forEach(el => {
            el.innerText = currentBalance.toFixed(2);
        });

        alert(`Баланс успешно пополнен на ${amount}!`);
        depositModal.style.display = 'none';
        depositAmountInput.value = '';
    });
}