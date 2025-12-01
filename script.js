// ===== КОНФИГУРАЦИЯ =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxSnTMn4s3DfRbq0SuxkRBpUifrtQQoacHEFYiGexBOAfm0n41SIUK6-rRVnkLT7x8hkw/exec';
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
        params.action = action;
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_URL}?${query}`);
        
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return { error: 'Network error' };
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
            points: result.points
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
    
    if (nickname.length < 3) {
        showNotification('Никнейм должен быть не менее 3 символов', 'error');
        return;
    }
    
    showNotification('Регистрация...', 'info');
    
    const result = await callAPI('register', { nickname, code });
    
    if (result.success) {
        currentUser = {
            id: result.userId,
            nickname: nickname,
            points: result.points
        };
        
        localStorage.setItem('heartbattle_user', JSON.stringify(currentUser));
        showNotification(`Регистрация успешна! Получено ${result.points} баллов`, 'success');
        switchToBattleScreen();
        loadProfile();
    } else {
        showNotification(result.error || 'Ошибка регистрации', 'error');
    }
}

// ===== ЗАГРУЗКА ПРОФИЛЯ =====
async function loadProfile() {
    if (!currentUser) return;
    
    showNotification('Ищем нового участника...', 'info');
    
    const result = await callAPI('get_profiles', { userId: currentUser.id });
    
    if (result.error) {
        elements.profileName.textContent = 'Анкеты закончились';
        elements.profileDescription.textContent = 'Все участники оценены! Загляни позже.';
        elements.imagePlaceholder.style.display = 'flex';
        elements.profileImage.style.display = 'none';
        currentProfile = null;
        return;
    }
    
    currentProfile = result;
    
    // Обновляем данные профиля с анимациями
    animateValue(elements.profileRating, 0, result.rating || 0, 1000);
    elements.profileId.textContent = result.profileId || '?';
    elements.profileName.textContent = result.name || 'Без имени';
    elements.profileDescription.textContent = result.description || 'Описание отсутствует';
    
    // Обновляем изображение
    if (result.photoUrl) {
        elements.profileImage.src = result.photoUrl;
        elements.profileImage.style.display = 'block';
        elements.imagePlaceholder.style.display = 'none';
        
        // Анимация появления изображения
        elements.profileImage.style.opacity = '0';
        setTimeout(() => {
            elements.profileImage.style.transition = 'opacity 0.5s ease';
            elements.profileImage.style.opacity = '1';
        }, 100);
    } else {
        elements.imagePlaceholder.style.display = 'flex';
        elements.profileImage.style.display = 'none';
    }
    
    // Обновляем прогресс бар
    const rating = Math.max(0, (result.rating || 0) + 50); // Приводим к шкале 0-100
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
    if (!currentUser || !currentProfile) return;
    
    // Проверяем лимит пропусков
    checkSkipReset();
    if (skipsUsed >= SKIPS_PER_HOUR) {
        const nextReset = new Date(lastSkipReset + 3600000);
        showNotification(`Лимит пропусков! Следующий сброс в ${nextReset.getHours()}:${nextReset.getMinutes()}`, 'error');
        return;
    }
    
    // Анимация
    elements.skipBtn.style.transform = 'scale(0.95)';
    setTimeout(() => elements.skipBtn.style.transform = '', 200);
    
    skipsUsed++;
    elements.skipCount.textContent = SKIPS_PER_HOUR - skipsUsed;
    localStorage.setItem('heartbattle_skips', JSON.stringify({
        used: skipsUsed,
        reset: lastSkipReset
    }));
    
    showNotification(`Пропущено! Осталось пропусков: ${SKIPS_PER_HOUR - skipsUsed}`, 'info');
    
    await callAPI('skip', {
        userId: currentUser.id,
        profileId: currentProfile.profileId
    });
    
    updateStats('skip');
    
    // Загружаем следующий профиль
    setTimeout(() => loadProfile(), 500);
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
            break;
        case 'error':
            notification.style.borderLeft = '4px solid #ff6464';
            break;
        case 'info':
            notification.style.borderLeft = '4px solid #6464ff';
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

// ===== ТАЙПИНГ АНИМАЦИЯ ДЛЯ ЗАГРОВКА =====
function startTypingAnimation() {
    const title = document.querySelector('.title');
    const originalText = title.textContent;
    title.textContent = '';
    
    let i = 0;
    function typeChar() {
        if (i < originalText.length) {
            title.textContent += originalText.charAt(i);
            i++;
            setTimeout(typeChar, 100);
        }
    }
    
    typeChar();
}

// Запускаем анимацию при загрузке
window.addEventListener('load', startTypingAnimation);
