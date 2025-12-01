// ===== КОНФИГУРАЦИЯ =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxH3-C1OkH6snl34hIu_t4ck--TOvvF83ZqMogOYSoP/dev';
const SKIPS_PER_HOUR = 5;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let currentProfile = null;
let skipsUsed = 0;
let lastSkipReset = Date.now();

// ===== ЭЛЕМЕНТЫ DOM =====
const elements = {
    // Экран авторизации
    authScreen: document.getElementById('authScreen'),
    battleScreen: document.getElementById('battleScreen'),
    nicknameInput: document.getElementById('nicknameInput'),
    codeInput: document.getElementById('codeInput'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
    
    // Экран голосования
    userNickname: document.getElementById('userNickname'),
    pointsCount: document.getElementById('pointsCount'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Карточка профиля
    profileId: document.getElementById('profileId'),
    profileName: document.getElementById('profileName'),
    profileDescription: document.getElementById('profileDescription'),
    profileImage: document.getElementById('profileImage'),
    imagePlaceholder: document.getElementById('imagePlaceholder'),
    profileRating: document.getElementById('profileRating'),
    
    // Прогресс бар
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    
    // Кнопки действий
    likeBtn: document.getElementById('likeBtn'),
    dislikeBtn: document.getElementById('dislikeBtn'),
    skipBtn: document.getElementById('skipBtn'),
    skipCount: document.getElementById('skipCount'),
    
    // Статистика
    totalVotes: document.getElementById('totalVotes'),
    likesCount: document.getElementById('likesCount'),
    dislikesCount: document.getElementById('dislikesCount'),
    skipsCount: document.getElementById('skipsCount'),
    
    // Уведомления
    notification: document.getElementById('notification'),
    
    // Превью статистики
    onlineCount: document.getElementById('onlineCount'),
    battleCount: document.getElementById('battleCount')
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkSkipReset();
    updatePreviewStats();
    
    // Проверяем, есть ли сохраненная сессия
    const savedUser = localStorage.getItem('heartbattle_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            switchToBattleScreen();
            loadProfile();
        } catch (e) {
            localStorage.removeItem('heartbattle_user');
        }
    }
});

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
function initializeEventListeners() {
    // Авторизация
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.registerBtn.addEventListener('click', handleRegister);
    elements.codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Голосование
    elements.likeBtn.addEventListener('click', () => handleVote('like'));
    elements.dislikeBtn.addEventListener('click', () => handleVote('dislike'));
    elements.skipBtn.addEventListener('click', handleSkip);
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Анимации при наведении
    [elements.likeBtn, elements.dislikeBtn, elements.skipBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-3px)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
        });
    });
}

// ===== API ВЗАИМОДЕЙСТВИЕ =====
async function callAPI(action, params = {}) {
    try {
        // Добавляем action в параметры
        params.action = action;
        
        // Формируем URL с параметрами
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_URL}?${queryString}`;
        
        console.log('📡 API Call:', action, params);
        
        // Делаем запрос
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ API Response:', data);
        return data;
        
    } catch (error) {
        console.error('❌ API Error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return { error: 'Network error: ' + error.message };
    }
}

// ===== АВТОРИЗАЦИЯ =====
async function handleLogin() {
    const nickname = elements.nicknameInput.value.trim();
    const code = elements.codeInput.value.trim();
    
    if (!nickname || !code) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    showNotification('Вход в систему...', 'info');
    
    const result = await callAPI('login', { nickname, code });
    
    if (result.success) {
        currentUser = {
            id: result.userId,
            nickname: nickname,
            points: result.points || 5
        };
        
        localStorage.setItem('heartbattle_user', JSON.stringify(currentUser));
        showNotification(`Добро пожаловать, ${nickname}!`, 'success');
        switchToBattleScreen();
        loadProfile();
    } else {
        showNotification(result.error || 'Ошибка входа', 'error');
    }
}

async function handleRegister() {
    const nickname = elements.nicknameInput.value.trim();
    const code = elements.codeInput.value.trim();
    
    if (!nickname || !code) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (nickname.length < 2) {
        showNotification('Никнейм должен быть не менее 2 символов', 'error');
        return;
    }
    
    showNotification('Регистрация...', 'info');
    
    const result = await callAPI('register', { nickname, code });
    
    if (result.success) {
        currentUser = {
            id: result.userId,
            nickname: nickname,
            points: result.points || 5
        };
        
        localStorage.setItem('heartbattle_user', JSON.stringify(currentUser));
        showNotification(`Регистрация успешна! Получено ${result.points || 5} баллов`, 'success');
        switchToBattleScreen();
        loadProfile();
    } else {
        showNotification(result.error || 'Ошибка регистрации', 'error');
    }
}

// ===== ЗАГРУЗКА ПРОФИЛЯ =====
async function loadProfile() {
    if (!currentUser) {
        showNotification('Сначала войдите в систему', 'error');
        return;
    }
    
    showNotification('Ищем нового участника...', 'info');
    
    const result = await callAPI('get_profiles', { userId: currentUser.id });
    
    if (result.error) {
        // Нет анкет или ошибка
        elements.profileName.textContent = 'Анкеты временно отсутствуют';
        elements.profileDescription.textContent = 'Все участники оценены или произошла ошибка. Попробуйте позже.';
        elements.imagePlaceholder.style.display = 'flex';
        elements.profileImage.style.display = 'none';
        elements.profileRating.textContent = '0';
        currentProfile = null;
        
        // Обновляем прогресс бар
        elements.progressPercent.textContent = '0%';
        elements.progressFill.style.width = '0%';
        
        showNotification(result.error, 'error');
        return;
    }
    
    currentProfile = result;
    
    // Обновляем данные профиля с анимациями
    animateValue(elements.profileRating, 0, result.rating || 0, 1000);
    elements.profileId.textContent = result.profileId || '?';
    elements.profileName.textContent = result.name || 'Без имени';
    elements.profileDescription.textContent = result.description || 'Описание отсутствует';
    
    // Обновляем изображение
    if (result.photoUrl && result.photoUrl.startsWith('http')) {
        // Создаем новое изображение для предзагрузки
        const img = new Image();
        img.onload = () => {
            elements.profileImage.src = result.photoUrl;
            elements.profileImage.style.display = 'block';
            elements.imagePlaceholder.style.display = 'none';
            
            // Анимация появления
            elements.profileImage.style.opacity = '0';
            setTimeout(() => {
                elements.profileImage.style.transition = 'opacity 0.5s ease';
                elements.profileImage.style.opacity = '1';
            }, 100);
        };
        img.onerror = () => {
            // Если изображение не загрузилось
            elements.imagePlaceholder.style.display = 'flex';
            elements.profileImage.style.display = 'none';
        };
        img.src = result.photoUrl;
    } else {
        // Нет валидного URL изображения
        elements.imagePlaceholder.style.display = 'flex';
        elements.profileImage.style.display = 'none';
    }
    
    // Обновляем прогресс бар (рейтинг от 0 до 100)
    const rating = Math.max(0, (result.rating || 0) + 50); // Преобразуем к шкале 0-100
    const percent = Math.min(100, Math.max(0, rating));
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
    
    showNotification('Новый участник готов к оценке!', 'info');
}

// ===== ГОЛОСОВАНИЕ =====
async function handleVote(voteType) {
    if (!currentUser || !currentProfile) {
        showNotification('Сначала загрузите профиль', 'error');
        return;
    }
    
    const cost = voteType === 'like' ? 1 : 2;
    
    if (currentUser.points < cost) {
        showNotification(`Недостаточно баллов! Нужно: ${cost}`, 'error');
        return;
    }
    
    // Анимация кнопки
    const btn = voteType === 'like' ? elements.likeBtn : elements.dislikeBtn;
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 200);
    
    showNotification(`Голосование... (стоимость: ${cost} балл${cost > 1 ? 'а' : ''})`, 'info');
    
    const result = await callAPI('vote', {
        userId: currentUser.id,
        profileId: currentProfile.profileId,
        voteType: voteType
    });
    
    if (result.success) {
        // Обновляем баллы с анимацией
        animateValue(elements.pointsCount, currentUser.points, result.newPoints, 500);
        currentUser.points = result.newPoints;
        localStorage.setItem('heartbattle_user', JSON.stringify(currentUser));
        
        // Обновляем статистику
        updateStats(voteType);
        
        // Уведомление
        const message = voteType === 'like' ? '❤️ Лайк поставлен!' : '👎 Дизлайк поставлен!';
        showNotification(`${message} Осталось баллов: ${result.newPoints}`, 'success');
        
        // Загружаем следующий профиль
        setTimeout(() => loadProfile(), 800);
    } else {
        showNotification(result.error || 'Ошибка голосования', 'error');
    }
}

// ===== ПРОПУСК =====
async function handleSkip() {
    if (!currentUser || !currentProfile) {
        showNotification('Сначала загрузите профиль', 'error');
        return;
    }
    
    // Проверяем лимит пропусков
    checkSkipReset();
    if (skipsUsed >= SKIPS_PER_HOUR) {
        const nextReset = new Date(lastSkipReset + 3600000);
        const hours = nextReset.getHours().toString().padStart(2, '0');
        const minutes = nextReset.getMinutes().toString().padStart(2, '0');
        showNotification(`Лимит пропусков! Следующий сброс в ${hours}:${minutes}`, 'error');
        return;
    }
    
    // Анимация
    elements.skipBtn.style.transform = 'scale(0.95)';
    setTimeout(() => elements.skipBtn.style.transform = '', 200);
    
    showNotification('Пропускаем профиль...', 'info');
    
    const result = await callAPI('skip', {
        userId: currentUser.id,
        profileId: currentProfile.profileId
    });
    
    if (result.success) {
        skipsUsed++;
        elements.skipCount.textContent = SKIPS_PER_HOUR - skipsUsed;
        localStorage.setItem('heartbattle_skips', JSON.stringify({
            used: skipsUsed,
            reset: lastSkipReset
        }));
        
        updateStats('skip');
        showNotification(`Пропущено! Осталось пропусков: ${SKIPS_PER_HOUR - skipsUsed}`, 'info');
        
        // Загружаем следующий профиль
        setTimeout(() => loadProfile(), 500);
    } else {
        showNotification(result.error || 'Ошибка пропуска', 'error');
    }
}

// ===== СТАТИСТИКА =====
function updateStats(action) {
    const stats = {
        total: parseInt(elements.totalVotes.textContent) || 0,
        likes: parseInt(elements.likesCount.textContent) || 0,
        dislikes: parseInt(elements.dislikesCount.textContent) || 0,
        skips: parseInt(elements.skipsCount.textContent) || 0
    };
    
    stats.total++;
    
    switch(action) {
        case 'like': stats.likes++; break;
        case 'dislike': stats.dislikes++; break;
        case 'skip': stats.skips++; break;
    }
    
    animateValue(elements.totalVotes, elements.totalVotes.textContent, stats.total, 500);
    animateValue(elements.likesCount, elements.likesCount.textContent, stats.likes, 500);
    animateValue(elements.dislikesCount, elements.dislikesCount.textContent, stats.dislikes, 500);
    animateValue(elements.skipsCount, elements.skipsCount.textContent, stats.skips, 500);
}

// ===== УПРАВЛЕНИЕ ЭКРАНАМИ =====
function switchToBattleScreen() {
    elements.authScreen.classList.remove('active');
    elements.battleScreen.classList.add('active');
    
    if (currentUser) {
        elements.userNickname.textContent = currentUser.nickname;
        elements.pointsCount.textContent = currentUser.points;
    }
    
    // Загружаем сохраненные пропуски
    const savedSkips = localStorage.getItem('heartbattle_skips');
    if (savedSkips) {
        try {
            const data = JSON.parse(savedSkips);
            skipsUsed = data.used || 0;
            lastSkipReset = data.reset || Date.now();
        } catch (e) {
            skipsUsed = 0;
            lastSkipReset = Date.now();
        }
    }
    
    elements.skipCount.textContent = SKIPS_PER_HOUR - skipsUsed;
    
    // Сбрасываем статистику
    elements.totalVotes.textContent = '0';
    elements.likesCount.textContent = '0';
    elements.dislikesCount.textContent = '0';
    elements.skipsCount.textContent = '0';
}

function handleLogout() {
    currentUser = null;
    currentProfile = null;
    localStorage.removeItem('heartbattle_user');
    
    elements.authScreen.classList.add('active');
    elements.battleScreen.classList.remove('active');
    
    elements.nicknameInput.value = '';
    elements.codeInput.value = '';
    
    showNotification('Вы вышли из системы', 'info');
}

// ===== УТИЛИТЫ =====
function showNotification(message, type = 'info') {
    const notification = elements.notification;
    
    notification.textContent = message;
    notification.className = 'notification';
    
    // Цвет в зависимости от типа
    switch(type) {
        case 'success':
            notification.style.borderLeft = '4px solid #64ff64';
            notification.style.background = 'rgba(100, 255, 100, 0.1)';
            break;
        case 'error':
            notification.style.borderLeft = '4px solid #ff6464';
            notification.style.background = 'rgba(255, 100, 100, 0.1)';
            break;
        case 'info':
            notification.style.borderLeft = '4px solid #6495ff';
            notification.style.background = 'rgba(100, 149, 255, 0.1)';
            break;
    }
    
    notification.classList.add('show');
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function animateValue(element, start, end, duration) {
    const startNum = parseInt(start) || 0;
    const endNum = parseInt(end) || 0;
    
    if (startNum === endNum) {
        element.textContent = endNum;
        return;
    }
    
    const range = endNum - startNum;
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(startNum + (range * progress));
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = endNum;
        }
    }
    
    update();
}

function checkSkipReset() {
    const now = Date.now();
    const hoursSinceReset = (now - lastSkipReset) / 3600000;
    
    if (hoursSinceReset >= 1) {
        skipsUsed = 0;
        lastSkipReset = now;
        elements.skipCount.textContent = SKIPS_PER_HOUR;
        
        localStorage.setItem('heartbattle_skips', JSON.stringify({
            used: skipsUsed,
            reset: lastSkipReset
        }));
        
        showNotification('Лимит пропусков сброшен!', 'info');
    }
}

function updatePreviewStats() {
    // Здесь можно добавить API для получения статистики
    const randomOnline = Math.floor(Math.random() * 50) + 20;
    const randomBattles = Math.floor(Math.random() * 1000) + 500;
    
    elements.onlineCount.textContent = randomOnline;
    elements.battleCount.textContent = randomBattles;
    
    // Обновляем каждую минуту
    setTimeout(updatePreviewStats, 60000);
}

// ===== АВТОМАТИЧЕСКИЕ ДЕЙСТВИЯ =====

// Проверяем баллы каждые 30 секунд
setInterval(() => {
    if (currentUser) {
        callAPI('get_user_points', { userId: currentUser.id })
            .then(result => {
                if (result.success && result.points !== currentUser.points) {
                    animateValue(elements.pointsCount, currentUser.points, result.points, 500);
                    currentUser.points = result.points;
                    localStorage.setItem('heartbattle_user', JSON.stringify(currentUser));
                }
            });
    }
}, 30000);

// Проверяем сброс пропусков каждые 5 минут
setInterval(checkSkipReset, 300000);

// ===== ТЕСТОВЫЕ ФУНКЦИИ ДЛЯ ОТЛАДКИ =====
window.testAPI = function() {
    console.log('=== ТЕСТ API ===');
    console.log('Текущий пользователь:', currentUser);
    console.log('Текущий профиль:', currentProfile);
    
    // Тестовые запросы
    callAPI('test', {}).then(console.log);
    
    if (currentUser) {
        callAPI('get_user_points', { userId: currentUser.id }).then(console.log);
    }
};

window.clearStorage = function() {
    localStorage.clear();
    location.reload();
};

// Запускаем анимацию при загрузке
window.addEventListener('load', startTypingAnimation);
