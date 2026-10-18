/**
 * Discord Cleaner - Frontend Application Logic
 */

const state = {
    user: null,
    dms: [],
    groups: [],
    guilds: [],
    selectedDmIds: new Set(),
    selectedGroupIds: new Set(),
    selectedGuildIds: new Set(),
    currentTab: 'dms',
    dmsFilter: '',
    groupsFilter: '',
    guildsFilter: '',
    isPolling: false,
    pollTimer: null
};

// DOM Elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const tokenInput = document.getElementById('tokenInput');
const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
const loginBtn = document.getElementById('loginBtn');
const loginSpinner = document.getElementById('loginSpinner');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userTag = document.getElementById('userTag');
const logoutBtn = document.getElementById('logoutBtn');

// Tabs
const tabDmsBtn = document.getElementById('tabDmsBtn');
const tabGroupsBtn = document.getElementById('tabGroupsBtn');
const tabGuildsBtn = document.getElementById('tabGuildsBtn');
const tabLogsBtn = document.getElementById('tabLogsBtn');

const dmsTabContent = document.getElementById('dmsTabContent');
const groupsTabContent = document.getElementById('groupsTabContent');
const guildsTabContent = document.getElementById('guildsTabContent');
const logsTabContent = document.getElementById('logsTabContent');

const dmsCountBadge = document.getElementById('dmsCountBadge');
const groupsCountBadge = document.getElementById('groupsCountBadge');
const guildsCountBadge = document.getElementById('guildsCountBadge');
const refreshDataBtn = document.getElementById('refreshDataBtn');

// Search & Lists
const dmsSearchInput = document.getElementById('dmsSearchInput');
const groupsSearchInput = document.getElementById('groupsSearchInput');
const guildsSearchInput = document.getElementById('guildsSearchInput');

const dmsFilteredCount = document.getElementById('dmsFilteredCount');
const groupsFilteredCount = document.getElementById('groupsFilteredCount');
const guildsFilteredCount = document.getElementById('guildsFilteredCount');

const dmsList = document.getElementById('dmsList');
const groupsList = document.getElementById('groupsList');
const guildsList = document.getElementById('guildsList');

const emptyDmsMsg = document.getElementById('emptyDmsMsg');
const emptyGroupsMsg = document.getElementById('emptyGroupsMsg');
const emptyGuildsMsg = document.getElementById('emptyGuildsMsg');

// Quick Selection Buttons
const selectAllDmsBtn = document.getElementById('selectAllDmsBtn');
const deselectAllDmsBtn = document.getElementById('deselectAllDmsBtn');
const invertDmsBtn = document.getElementById('invertDmsBtn');
const selectOldDmsBtn = document.getElementById('selectOldDmsBtn');

const selectAllGroupsBtn = document.getElementById('selectAllGroupsBtn');
const deselectAllGroupsBtn = document.getElementById('deselectAllGroupsBtn');
const invertGroupsBtn = document.getElementById('invertGroupsBtn');
const selectOldGroupsBtn = document.getElementById('selectOldGroupsBtn');

const selectAllGuildsBtn = document.getElementById('selectAllGuildsBtn');
const deselectAllGuildsBtn = document.getElementById('deselectAllGuildsBtn');
const invertGuildsBtn = document.getElementById('invertGuildsBtn');
const selectOnlyJoinedGuildsBtn = document.getElementById('selectOnlyJoinedGuildsBtn');

// Bottom Action Bar
const selectedToLeaveCount = document.getElementById('selectedToLeaveCount');
const remainingCount = document.getElementById('remainingCount');
const delayInput = document.getElementById('delayInput');
const startLeaveBtn = document.getElementById('startLeaveBtn');
const btnLeaveCount = document.getElementById('btnLeaveCount');

// Logs
const liveLogsContainer = document.getElementById('liveLogsContainer');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// Confirm Modal
const confirmModal = document.getElementById('confirmModal');
const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const executeLeaveBtn = document.getElementById('executeLeaveBtn');
const confirmTotalCount = document.getElementById('confirmTotalCount');
const confirmSummaryList = document.getElementById('confirmSummaryList');
const ownerWarningBox = document.getElementById('ownerWarningBox');
const confirmOwnedCount = document.getElementById('confirmOwnedCount');
const confirmDeleteOwnedCheckbox = document.getElementById('confirmDeleteOwnedCheckbox');

// Progress Modal
const progressModal = document.getElementById('progressModal');
const progressStatusText = document.getElementById('progressStatusText');
const progressCounter = document.getElementById('progressCounter');
const progressBarFill = document.getElementById('progressBarFill');
const currentItemName = document.getElementById('currentItemName');
const statSuccess = document.getElementById('statSuccess');
const statErrors = document.getElementById('statErrors');
const progressMiniLog = document.getElementById('progressMiniLog');
const stopProcessBtn = document.getElementById('stopProcessBtn');
const finishProcessBtn = document.getElementById('finishProcessBtn');

// Init
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkInitialStatus();
});

function initEventListeners() {
    toggleTokenVisibility.addEventListener('click', () => {
        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleTokenVisibility.textContent = '🔒';
        } else {
            tokenInput.type = 'password';
            toggleTokenVisibility.textContent = '👁️';
        }
    });

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Tab Navigation
    tabDmsBtn.addEventListener('click', () => switchTab('dms'));
    tabGroupsBtn.addEventListener('click', () => switchTab('groups'));
    tabGuildsBtn.addEventListener('click', () => switchTab('guilds'));
    tabLogsBtn.addEventListener('click', () => switchTab('logs'));
    refreshDataBtn.addEventListener('click', loadDiscordData);

    // Search inputs
    dmsSearchInput.addEventListener('input', (e) => {
        state.dmsFilter = e.target.value.toLowerCase().trim();
        renderDms();
    });

    groupsSearchInput.addEventListener('input', (e) => {
        state.groupsFilter = e.target.value.toLowerCase().trim();
        renderGroups();
    });

    guildsSearchInput.addEventListener('input', (e) => {
        state.guildsFilter = e.target.value.toLowerCase().trim();
        renderGuilds();
    });

    // DMs Quick Actions
    selectAllDmsBtn.addEventListener('click', () => {
        getFilteredDms().forEach(d => state.selectedDmIds.add(d.id));
        renderDms();
        updateSummary();
    });

    deselectAllDmsBtn.addEventListener('click', () => {
        state.selectedDmIds.clear();
        renderDms();
        updateSummary();
    });

    invertDmsBtn.addEventListener('click', () => {
        getFilteredDms().forEach(d => {
            if (state.selectedDmIds.has(d.id)) {
                state.selectedDmIds.delete(d.id);
            } else {
                state.selectedDmIds.add(d.id);
            }
        });
        renderDms();
        updateSummary();
    });

    selectOldDmsBtn.addEventListener('click', () => {
        const thirtyDaysAgo = (Date.now() / 1000) - (30 * 24 * 60 * 60);
        getFilteredDms().forEach(d => {
            if (!d.last_activity_ts || d.last_activity_ts < thirtyDaysAgo) {
                state.selectedDmIds.add(d.id);
            }
        });
        renderDms();
        updateSummary();
    });

    // Groups Quick Actions
    selectAllGroupsBtn.addEventListener('click', () => {
        getFilteredGroups().forEach(g => state.selectedGroupIds.add(g.id));
        renderGroups();
        updateSummary();
    });

    deselectAllGroupsBtn.addEventListener('click', () => {
        state.selectedGroupIds.clear();
        renderGroups();
        updateSummary();
    });

    invertGroupsBtn.addEventListener('click', () => {
        getFilteredGroups().forEach(g => {
            if (state.selectedGroupIds.has(g.id)) {
                state.selectedGroupIds.delete(g.id);
            } else {
                state.selectedGroupIds.add(g.id);
            }
        });
        renderGroups();
        updateSummary();
    });

    selectOldGroupsBtn.addEventListener('click', () => {
        const thirtyDaysAgo = (Date.now() / 1000) - (30 * 24 * 60 * 60);
        getFilteredGroups().forEach(g => {
            if (!g.last_activity_ts || g.last_activity_ts < thirtyDaysAgo) {
                state.selectedGroupIds.add(g.id);
            }
        });
        renderGroups();
        updateSummary();
    });

    // Guilds Quick Actions
    selectAllGuildsBtn.addEventListener('click', () => {
        getFilteredGuilds().forEach(g => state.selectedGuildIds.add(g.id));
        renderGuilds();
        updateSummary();
    });

    deselectAllGuildsBtn.addEventListener('click', () => {
        state.selectedGuildIds.clear();
        renderGuilds();
        updateSummary();
    });

    invertGuildsBtn.addEventListener('click', () => {
        getFilteredGuilds().forEach(g => {
            if (state.selectedGuildIds.has(g.id)) {
                state.selectedGuildIds.delete(g.id);
            } else {
                state.selectedGuildIds.add(g.id);
            }
        });
        renderGuilds();
        updateSummary();
    });

    selectOnlyJoinedGuildsBtn.addEventListener('click', () => {
        getFilteredGuilds().forEach(g => {
            if (!g.is_owner) {
                state.selectedGuildIds.add(g.id);
            }
        });
        renderGuilds();
        updateSummary();
    });

    clearLogsBtn.addEventListener('click', () => {
        liveLogsContainer.innerHTML = '<div class="log-entry info"><span class="time">[' + getCurrentTimeStr() + ']</span> Лог очищен.</div>';
    });

    startLeaveBtn.addEventListener('click', openConfirmModal);
    closeConfirmModalBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));
    cancelConfirmBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));
    executeLeaveBtn.addEventListener('click', executeLeaveProcess);

    stopProcessBtn.addEventListener('click', async () => {
        stopProcessBtn.disabled = true;
        stopProcessBtn.textContent = 'Останавливаем...';
        await fetch('/api/stop', { method: 'POST' });
    });

    finishProcessBtn.addEventListener('click', () => {
        progressModal.classList.add('hidden');
        loadDiscordData();
    });
}

function getCurrentTimeStr() {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
}

async function checkInitialStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.has_token && data.user) {
            setUserLoggedIn(data.user);
            await loadDiscordData();
            return;
        }
    } catch (e) {
        console.error("Initial check error:", e);
    }
    
    loadDetectedAccounts();
}

async function loadDetectedAccounts() {
    const container = document.getElementById('detectedAccountsList');
    const rescanBtn = document.getElementById('rescanTokensBtn');
    if (!container) return;

    container.innerHTML = `
        <div class="detecting-loader">
            <span class="spinner"></span> Поиск активных аккаунтов Discord на ПК...
        </div>
    `;

    if (rescanBtn) {
        rescanBtn.onclick = () => loadDetectedAccounts();
    }

    try {
        const res = await fetch('/api/detected-accounts');
        const data = await res.json();

        if (data.success && data.accounts && data.accounts.length > 0) {
            container.innerHTML = '';
            data.accounts.forEach(acc => {
                const card = document.createElement('div');
                card.className = 'detected-account-card';
                card.innerHTML = `
                    <div class="detected-account-left">
                        <img class="detected-account-avatar" src="${acc.avatar_url}" alt="Avatar">
                        <div class="detected-account-info">
                            <span class="detected-account-name">${escapeHtml(acc.global_name || acc.username)}</span>
                            <span class="detected-account-username">@${escapeHtml(acc.username)}</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm">Войти в 1 клик</button>
                `;

                const loginBtn = card.querySelector('button');
                loginBtn.onclick = async () => {
                    loginBtn.disabled = true;
                    loginBtn.textContent = 'Вход...';
                    tokenInput.value = acc.token;
                    await handleLogin();
                };

                container.appendChild(card);
            });
        } else {
            container.innerHTML = `
                <div style="font-size:0.82rem; color:var(--text-muted); padding:4px 0;">
                    Автоматически аккаунты не найдены. Введите токен вручную ниже.
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `
            <div style="font-size:0.82rem; color:var(--text-muted);">
                Не удалось просканировать локальные аккаунты.
            </div>
        `;
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) return;

    loginBtn.disabled = true;
    loginSpinner.classList.remove('hidden');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();

        if (data.success) {
            setUserLoggedIn(data.user);
            await loadDiscordData();
        } else {
            alert('Ошибка входа: ' + (data.error || 'Неверный токен'));
        }
    } catch (err) {
        alert('Сетевая ошибка при проверке токена: ' + err.message);
    } finally {
        loginBtn.disabled = false;
        loginSpinner.classList.add('hidden');
    }
}

function setUserLoggedIn(user) {
    state.user = user;
    userName.textContent = user.global_name || user.username;
    userTag.textContent = '@' + user.username;
    userAvatar.src = user.avatar_url;
    
    userProfile.classList.remove('hidden');
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

async function handleLogout() {
    if (!confirm('Вы уверены, что хотите выйти из аккаунта?')) return;
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}

    state.user = null;
    state.dms = [];
    state.groups = [];
    state.guilds = [];
    state.selectedDmIds.clear();
    state.selectedGroupIds.clear();
    state.selectedGuildIds.clear();
    
    userProfile.classList.add('hidden');
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    tokenInput.value = '';
}

function switchTab(tab) {
    state.currentTab = tab;
    tabDmsBtn.classList.toggle('active', tab === 'dms');
    tabGroupsBtn.classList.toggle('active', tab === 'groups');
    tabGuildsBtn.classList.toggle('active', tab === 'guilds');
    tabLogsBtn.classList.toggle('active', tab === 'logs');

    dmsTabContent.classList.toggle('hidden', tab !== 'dms');
    groupsTabContent.classList.toggle('hidden', tab !== 'groups');
    guildsTabContent.classList.toggle('hidden', tab !== 'guilds');
    logsTabContent.classList.toggle('hidden', tab !== 'logs');
}

async function loadDiscordData() {
    refreshDataBtn.disabled = true;
    refreshDataBtn.textContent = '🔄 Загрузка...';

    try {
        const res = await fetch('/api/data');
        const data = await res.json();

        if (data.success) {
            state.dms = data.dms || [];
            state.groups = data.groups || [];
            state.guilds = data.guilds || [];

            // Prune selections
            const dmIds = new Set(state.dms.map(d => d.id));
            state.selectedDmIds = new Set([...state.selectedDmIds].filter(id => dmIds.has(id)));

            const groupIds = new Set(state.groups.map(g => g.id));
            state.selectedGroupIds = new Set([...state.selectedGroupIds].filter(id => groupIds.has(id)));

            const guildIds = new Set(state.guilds.map(g => g.id));
            state.selectedGuildIds = new Set([...state.selectedGuildIds].filter(id => guildIds.has(id)));

            dmsCountBadge.textContent = state.dms.length;
            groupsCountBadge.textContent = state.groups.length;
            guildsCountBadge.textContent = state.guilds.length;

            renderDms();
            renderGroups();
            renderGuilds();
            updateSummary();
        } else {
            alert('Ошибка загрузки данных: ' + (data.error || 'Неизвестно'));
        }
    } catch (err) {
        alert('Ошибка связи с сервером: ' + err.message);
    } finally {
        refreshDataBtn.disabled = false;
        refreshDataBtn.textContent = '🔄 Обновить данные';
    }
}

function getFilteredDms() {
    if (!state.dmsFilter) return state.dms;
    return state.dms.filter(d => {
        const nameMatch = d.name.toLowerCase().includes(state.dmsFilter);
        const userMatch = d.username && d.username.toLowerCase().includes(state.dmsFilter);
        return nameMatch || userMatch;
    });
}

function getFilteredGroups() {
    if (!state.groupsFilter) return state.groups;
    return state.groups.filter(g => {
        const nameMatch = g.name.toLowerCase().includes(state.groupsFilter);
        const recipientMatch = g.recipients && g.recipients.some(r => r.toLowerCase().includes(state.groupsFilter));
        return nameMatch || recipientMatch;
    });
}

function getFilteredGuilds() {
    if (!state.guildsFilter) return state.guilds;
    return state.guilds.filter(g => g.name.toLowerCase().includes(state.guildsFilter));
}

function renderDms() {
    const filtered = getFilteredDms();
    dmsFilteredCount.textContent = `Показано: ${filtered.length} из ${state.dms.length}`;
    dmsList.innerHTML = '';

    if (filtered.length === 0) {
        emptyDmsMsg.classList.remove('hidden');
        return;
    }
    emptyDmsMsg.classList.add('hidden');

    filtered.forEach(dm => {
        const isSelected = state.selectedDmIds.has(dm.id);
        const card = document.createElement('div');
        card.className = `card ${isSelected ? 'selected-to-leave' : ''}`;
        card.dataset.id = dm.id;

        const firstLetter = (dm.name || 'U').trim().charAt(0).toUpperCase();
        const avatarHtml = dm.avatar_url 
            ? `<img class="card-avatar" src="${dm.avatar_url}" alt="Avatar" onerror="this.src=''; this.innerText='${firstLetter}'">`
            : `<div class="card-avatar">${firstLetter}</div>`;

        const statusBadge = isSelected 
            ? `<span class="badge-status leave">🚪 Будет закрыт</span>`
            : `<span class="badge-status keep">✨ Останется</span>`;

        card.innerHTML = `
            <div class="card-checkbox">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            ${avatarHtml}
            <div class="card-info">
                <div class="card-title-row">
                    <span class="card-title" title="${escapeHtml(dm.name)}">${escapeHtml(dm.name)}</span>
                    <div class="card-badges">
                        ${statusBadge}
                    </div>
                </div>
                <div class="card-meta">
                    <span>@${escapeHtml(dm.username)}</span>
                    <span>🕒 Посл. активность: ${dm.last_activity_str}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (state.selectedDmIds.has(dm.id)) {
                state.selectedDmIds.delete(dm.id);
            } else {
                state.selectedDmIds.add(dm.id);
            }
            renderDms();
            updateSummary();
        });

        dmsList.appendChild(card);
    });
}

function renderGroups() {
    const filtered = getFilteredGroups();
    groupsFilteredCount.textContent = `Показано: ${filtered.length} из ${state.groups.length}`;
    groupsList.innerHTML = '';

    if (filtered.length === 0) {
        emptyGroupsMsg.classList.remove('hidden');
        return;
    }
    emptyGroupsMsg.classList.add('hidden');

    filtered.forEach(group => {
        const isSelected = state.selectedGroupIds.has(group.id);
        const card = document.createElement('div');
        card.className = `card ${isSelected ? 'selected-to-leave' : ''}`;
        card.dataset.id = group.id;

        const firstLetter = (group.name || 'G').trim().charAt(0).toUpperCase();
        const avatarHtml = group.icon_url 
            ? `<img class="card-avatar" src="${group.icon_url}" alt="Icon" onerror="this.src=''; this.innerText='${firstLetter}'">`
            : `<div class="card-avatar">${firstLetter}</div>`;

        const statusBadge = isSelected 
            ? `<span class="badge-status leave">🚪 Будет покинут</span>`
            : `<span class="badge-status keep">✨ Останется</span>`;

        const ownerBadge = group.is_owner ? `<span class="badge badge-owner">👑 Создатель</span>` : '';

        card.innerHTML = `
            <div class="card-checkbox">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            ${avatarHtml}
            <div class="card-info">
                <div class="card-title-row">
                    <span class="card-title" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</span>
                    <div class="card-badges">
                        ${ownerBadge}
                        ${statusBadge}
                    </div>
                </div>
                <div class="card-meta">
                    <span>👥 Участников: ${group.recipients_count}</span>
                    <span>🕒 Посл. активность: ${group.last_activity_str}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (state.selectedGroupIds.has(group.id)) {
                state.selectedGroupIds.delete(group.id);
            } else {
                state.selectedGroupIds.add(group.id);
            }
            renderGroups();
            updateSummary();
        });

        groupsList.appendChild(card);
    });
}

function renderGuilds() {
    const filtered = getFilteredGuilds();
    guildsFilteredCount.textContent = `Показано: ${filtered.length} из ${state.guilds.length}`;
    guildsList.innerHTML = '';

    if (filtered.length === 0) {
        emptyGuildsMsg.classList.remove('hidden');
        return;
    }
    emptyGuildsMsg.classList.add('hidden');

    filtered.forEach(guild => {
        const isSelected = state.selectedGuildIds.has(guild.id);
        const card = document.createElement('div');
        card.className = `card ${isSelected ? 'selected-to-leave' : ''}`;
        card.dataset.id = guild.id;

        const firstLetter = (guild.name || 'S').trim().charAt(0).toUpperCase();
        const avatarHtml = guild.icon_url 
            ? `<img class="card-avatar" src="${guild.icon_url}" alt="Icon" onerror="this.src=''; this.innerText='${firstLetter}'">`
            : `<div class="card-avatar">${firstLetter}</div>`;

        const statusBadge = isSelected 
            ? `<span class="badge-status leave">🚪 Будет покинут</span>`
            : `<span class="badge-status keep">✨ Останется</span>`;

        const ownerBadge = guild.is_owner ? `<span class="badge badge-owner">👑 Владелец</span>` : '';
        const membersStr = guild.approx_members ? `👥 ~${guild.approx_members.toLocaleString()} участников` : '👥 Сервер';

        card.innerHTML = `
            <div class="card-checkbox">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            ${avatarHtml}
            <div class="card-info">
                <div class="card-title-row">
                    <span class="card-title" title="${escapeHtml(guild.name)}">${escapeHtml(guild.name)}</span>
                    <div class="card-badges">
                        ${ownerBadge}
                        ${statusBadge}
                    </div>
                </div>
                <div class="card-meta">
                    <span>${membersStr}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (state.selectedGuildIds.has(guild.id)) {
                state.selectedGuildIds.delete(guild.id);
            } else {
                state.selectedGuildIds.add(guild.id);
            }
            renderGuilds();
            updateSummary();
        });

        guildsList.appendChild(card);
    });
}

function updateSummary() {
    const totalDms = state.dms.length;
    const totalGroups = state.groups.length;
    const totalGuilds = state.guilds.length;
    const totalAll = totalDms + totalGroups + totalGuilds;

    const selectedDmsCount = state.selectedDmIds.size;
    const selectedGroupsCount = state.selectedGroupIds.size;
    const selectedGuildsCount = state.selectedGuildIds.size;
    const totalSelected = selectedDmsCount + selectedGroupsCount + selectedGuildsCount;
    const totalRemaining = totalAll - totalSelected;

    selectedToLeaveCount.textContent = `К очистке: ${totalSelected}`;
    remainingCount.textContent = `Останется: ${totalRemaining}`;
    btnLeaveCount.textContent = totalSelected;

    startLeaveBtn.disabled = totalSelected === 0;
}

function openConfirmModal() {
    const selectedDms = state.dms.filter(d => state.selectedDmIds.has(d.id));
    const selectedGroups = state.groups.filter(g => state.selectedGroupIds.has(g.id));
    const selectedGuilds = state.guilds.filter(g => state.selectedGuildIds.has(g.id));
    const allSelected = [...selectedDms, ...selectedGroups, ...selectedGuilds];

    if (allSelected.length === 0) return;

    confirmTotalCount.textContent = allSelected.length;
    confirmSummaryList.innerHTML = '';

    allSelected.forEach(item => {
        const div = document.createElement('div');
        let icon = '👤';
        if (item.type === 'group') icon = '💬';
        if (item.type === 'guild') icon = '🏰';
        const ownerNote = item.is_owner ? ' [Владелец]' : '';
        div.textContent = `${icon} ${item.name}${ownerNote}`;
        confirmSummaryList.appendChild(div);
    });

    const ownedGuilds = selectedGuilds.filter(g => g.is_owner);
    if (ownedGuilds.length > 0) {
        ownerWarningBox.classList.remove('hidden');
        confirmOwnedCount.textContent = ownedGuilds.length;
        confirmDeleteOwnedCheckbox.checked = false;
        executeLeaveBtn.disabled = true;

        confirmDeleteOwnedCheckbox.onchange = () => {
            executeLeaveBtn.disabled = !confirmDeleteOwnedCheckbox.checked;
        };
    } else {
        ownerWarningBox.classList.add('hidden');
        executeLeaveBtn.disabled = false;
    }

    confirmModal.classList.remove('hidden');
}

async function executeLeaveProcess() {
    const selectedDms = state.dms.filter(d => state.selectedDmIds.has(d.id));
    const selectedGroups = state.groups.filter(g => state.selectedGroupIds.has(g.id));
    const selectedGuilds = state.guilds.filter(g => state.selectedGuildIds.has(g.id));
    const deleteOwned = confirmDeleteOwnedCheckbox.checked;

    const itemsToLeave = [
        ...selectedDms.map(d => ({
            id: d.id,
            name: d.name,
            type: 'dm'
        })),
        ...selectedGroups.map(g => ({
            id: g.id,
            name: g.name,
            type: 'group',
            is_owner: g.is_owner
        })),
        ...selectedGuilds.map(g => ({
            id: g.id,
            name: g.name,
            type: 'guild',
            is_owner: g.is_owner,
            delete_owned: deleteOwned
        }))
    ];

    const delay = parseFloat(delayInput.value) || 1.5;

    confirmModal.classList.add('hidden');
    showProgressModal(itemsToLeave.length);

    try {
        const res = await fetch('/api/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: itemsToLeave,
                delay: delay
            })
        });

        const data = await res.json();
        if (!data.success) {
            alert('Ошибка запуска: ' + data.error);
            progressModal.classList.add('hidden');
            return;
        }

        startPollingTask();
    } catch (err) {
        alert('Ошибка отправки команды: ' + err.message);
        progressModal.classList.add('hidden');
    }
}

function showProgressModal(total) {
    progressModal.classList.remove('hidden');
    stopProcessBtn.classList.remove('hidden');
    stopProcessBtn.disabled = false;
    stopProcessBtn.textContent = '⏹️ Остановить процесс';
    finishProcessBtn.classList.add('hidden');

    progressStatusText.textContent = 'Выполнение очистки...';
    progressCounter.textContent = `0 / ${total}`;
    progressBarFill.style.width = '0%';
    currentItemName.textContent = 'Подготовка...';
    statSuccess.textContent = '0';
    statErrors.textContent = '0';
    progressMiniLog.innerHTML = '';
}

function startPollingTask() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    state.pollTimer = setInterval(async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            const task = data.task;

            if (!task) return;

            const total = task.total || 1;
            const current = task.current || 0;
            const percent = Math.min(100, Math.round((current / total) * 100));

            progressBarFill.style.width = `${percent}%`;
            progressCounter.textContent = `${current} / ${total}`;
            currentItemName.textContent = task.current_name || '-';
            statSuccess.textContent = task.success_count || 0;
            statErrors.textContent = task.error_count || 0;

            if (task.logs && task.logs.length > 0) {
                renderLogs(task.logs);
            }

            if (!task.running) {
                clearInterval(state.pollTimer);
                state.pollTimer = null;

                stopProcessBtn.classList.add('hidden');
                finishProcessBtn.classList.remove('hidden');

                if (task.status === 'completed') {
                    progressStatusText.textContent = '✅ Очистка успешно завершена!';
                } else if (task.status === 'stopped') {
                    progressStatusText.textContent = '⏹️ Процесс был остановлен.';
                } else {
                    progressStatusText.textContent = 'Готово';
                }
            }
        } catch (e) {
            console.error("Polling error:", e);
        }
    }, 600);
}

function renderLogs(logs) {
    const miniRecent = logs.slice(-8);
    progressMiniLog.innerHTML = miniRecent.map(l => `
        <div class="log-entry ${l.level}">
            <span class="time">[${l.time}]</span> ${escapeHtml(l.text)}
        </div>
    `).join('');
    progressMiniLog.scrollTop = progressMiniLog.scrollHeight;

    liveLogsContainer.innerHTML = logs.map(l => `
        <div class="log-entry ${l.level}">
            <span class="time">[${l.time}]</span> ${escapeHtml(l.text)}
        </div>
    `).join('');
    liveLogsContainer.scrollTop = liveLogsContainer.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
