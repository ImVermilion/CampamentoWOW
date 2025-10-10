// ==========================================================
// 1. CONSTANTES GLOBALES Y CONFIGURACIÓN DE GITHUB
// ==========================================================
const STORAGE_KEYS = {
    location: 'campLocation',
    money: 'campMoney',
    quests: 'campQuests',
    inventory: 'campInventory',
    history: 'campHistory',
    currentUser: 'currentUser',
    isEditorLoggedIn: 'isEditorLoggedIn' 
};

// =========================================================================
// !!! ATENCIÓN: DEBES REEMPLAZAR ESTOS VALORES CON TUS DATOS DE GITHUB !!!
// =========================================================================
const GITHUB_USERNAME = "ImVermilion"; 
const REPO_NAME = "CampamentoWoW"; 
const GITHUB_TOKEN = "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"; 
const COMMIT_AUTHOR_EMAIL = "thefer4death@gmail.com"; 
// =========================================================================

// CÁMBIALA POR UNA CONTRASEÑA FUERTE Y COMPÁRTELA SOLO CON LOS EDITORES
const GLOBAL_EDITOR_PASSWORD = "..LPeditor.."; 

// Datos de respaldo, solo se usan si falla la carga del data.json y no hay LocalStorage.
const initialData = { 
    location: "Torre de Vigía del Páramo de Poniente",
    money: { gold: 15, silver: 42, copper: 88 },
    quests: [
        { id: 1, title: "El Engranaje Perdido", objective: "Recuperar la pieza del Gnomo Mecánico.", reward: "3 Oro, 5 Plata", status: "EnProgreso" },
        { id: 2, title: "Suministros de Lona", objective: "Cazar 10 lobos para obtener cuero de calidad.", reward: "10 Plata", status: "Nueva" }
    ],
    inventory: [
        { name: "Poción de Sanación Mayor", quantity: 6 },
        { name: "Manta de Viaje Gruesa", quantity: 4 }
    ],
    history: []
};

let currentUser = localStorage.getItem(STORAGE_KEYS.currentUser) || null;
let isEditor = localStorage.getItem(STORAGE_KEYS.isEditorLoggedIn) === 'true'; 
let allowedUsersList = [];
let campLocation, campMoney, campQuests, campInventory, campHistory; 
let shaForUpdate = ''; // Almacenará el SHA del data.json actual para poder actualizarlo

/* --- Funciones de Persistencia Local --- */
async function loadServerData() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!response.ok) {
            // Intenta cargar sin token (asumiendo que es público, o por fallos de red)
            const fallbackResponse = await fetch('data.json');
            if (fallbackResponse.ok) {
                console.log("Cargando data.json sin API (fallback).");
                return await fallbackResponse.json();
            }
            console.error(`Error al cargar data.json desde GitHub API (${response.status}).`);
            return initialData; 
        }

        // Si la carga fue exitosa, obtenemos el SHA para futuras actualizaciones
        const contentResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const contentData = await contentResponse.json();
        shaForUpdate = contentData.sha;
        
        // Devolvemos el contenido del archivo
        return JSON.parse(await response.text());

    } catch (error) {
        console.error("Error grave al intentar obtener data.json:", error);
        return initialData;
    }
}

// Decide si usa LocalStorage (copia local más reciente) o datos del servidor
const getStorageData = (key, serverData) => {
    const data = localStorage.getItem(key);
    if (data && data !== "undefined") { 
        try { 
            return JSON.parse(data); 
        } catch (e) {
            console.error(`Error al parsear LocalStorage key: ${key}`, e);
            localStorage.removeItem(key);
            return serverData[key]; 
        }
    }
    return serverData[key];
};

const setStorageData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};


// ==========================================================
// 2. FUNCIÓN DE GUARDADO EN GITHUB (EL NÚCLEO)
// ==========================================================

async function saveServerData(commitMessage) {
    if (!isEditor) {
        alert("Permiso denegado. Solo los editores pueden guardar en GitHub.");
        return;
    }
    if (!GITHUB_TOKEN || GITHUB_TOKEN === "TU_TOKEN_DE_ACCESO_PERSONAL") {
        alert("ERROR: La aplicación no está configurada para guardar en GitHub. Completa GITHUB_TOKEN en script.js.");
        return;
    }
    
    // 1. Compilar todos los datos
    const fullState = {
        location: campLocation,
        money: campMoney,
        quests: campQuests,
        inventory: campInventory,
        history: campHistory
    };
    
    const dataStr = JSON.stringify(fullState, null, 4); 
    // GitHub API requiere el contenido en Base64
    const base64Content = btoa(unescape(encodeURIComponent(dataStr)));

    // 2. Preparar el payload para la API
    const payload = {
        message: commitMessage || `Update by ${currentUser}: ${new Date().toLocaleDateString()}`,
        content: base64Content,
        sha: shaForUpdate, // Usamos el SHA que obtuvimos al cargar para sobrescribir
        committer: {
            name: currentUser || GITHUB_USERNAME,
            email: COMMIT_AUTHOR_EMAIL
        }
    };

    // 3. Enviar la solicitud PUT a la API de GitHub
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/data.json`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            shaForUpdate = result.content.sha; // Actualizar el SHA para la próxima edición
            console.log("Guardado exitoso en GitHub. Nuevo SHA:", shaForUpdate);
            alert("✅ ¡Cambios guardados y compartidos globalmente!");
            return true;
        } else {
            const errorData = await response.json();
            console.error("Error al guardar en GitHub:", errorData);
            alert(`❌ Error al guardar en GitHub: ${errorData.message || 'Verifica tu token y permisos.'}`);
            return false;
        }
    } catch (error) {
        console.error("Error de red durante el guardado:", error);
        alert("❌ Error de conexión al intentar guardar en GitHub.");
        return false;
    }
}


// Función Wrapper para actualizar LocalStorage Y GitHub
function updateAllData(logType, logMessage, commitMessage) {
    // Primero, guardamos en LocalStorage
    setStorageData(STORAGE_KEYS.location, campLocation);
    setStorageData(STORAGE_KEYS.money, campMoney);
    setStorageData(STORAGE_KEYS.quests, campQuests);
    setStorageData(STORAGE_KEYS.inventory, campInventory);
    setStorageData(STORAGE_KEYS.history, campHistory);
    
    // Luego, registramos el evento en el historial local
    if (logType) logHistory(logType, logMessage);

    // Finalmente, guardamos el estado completo en el servidor
    saveServerData(commitMessage);
}


/* --- Carga de datos de la Whitelist --- */
async function loadWhitelist() {
    try {
        const response = await fetch('whitelist.json');
        if (!response.ok) {
            console.error("No se pudo cargar la whitelist.json. Se usará una lista vacía.");
            return;
        }
        const data = await response.json();
        allowedUsersList = data.allowed_users || [];
    } catch (error) {
        console.error("Error al obtener el archivo whitelist.json:", error);
    }
}

// ==========================================================
// 3. LÓGICA DE LOGIN Y PERMISOS (Sin cambios significativos)
// ==========================================================

window.showLogin = () => {
    document.getElementById('welcome-overlay').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
};

window.loginUser = () => {
    const user = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;
    const message = document.getElementById('login-message');

    if (!user) {
        message.textContent = "Debes ingresar tu Nombre de Héroe.";
        return;
    }
    
    const isUserAllowed = allowedUsersList.includes(user);
    const isPasswordCorrect = password === GLOBAL_EDITOR_PASSWORD;

    isEditor = isUserAllowed && isPasswordCorrect;

    currentUser = user;
    localStorage.setItem(STORAGE_KEYS.currentUser, currentUser);
    
    if (isEditor) {
        localStorage.setItem(STORAGE_KEYS.isEditorLoggedIn, 'true');
        alert(`¡Sesión iniciada como Editor! Bienvenido, ${currentUser}.`);
    } else {
        localStorage.removeItem(STORAGE_KEYS.isEditorLoggedIn);
        alert(`Sesión iniciada como Lector. Bienvenido, ${currentUser}.`);
    }
    
    document.getElementById('login-overlay').classList.add('hidden');
    updatePermissionsUI();
};

window.logoutUser = () => {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    localStorage.removeItem(STORAGE_KEYS.isEditorLoggedIn);
    
    isEditor = false; 
    
    alert("Has cerrado sesión. Vuelve a iniciar para continuar.");
    window.location.reload(); 
};

/** Muestra u oculta los botones de edición y actualiza la barra de usuario */
function updatePermissionsUI() {
    const editElements = document.querySelectorAll('.edit-btn, .add-btn, .quest-actions button, .item-remove, #reset-history-btn');
    
    const displayStyle = isEditor ? 'inline-block' : 'none';
    
    editElements.forEach(el => {
        if (el.tagName === 'DIV' && el.classList.contains('quest-actions')) {
            el.style.display = isEditor ? 'block' : 'none';
        } else {
            el.style.display = displayStyle;
        }
    });

    document.getElementById('location-edit-form')?.classList.add('hidden');
    document.getElementById('money-edit-form')?.classList.add('hidden');
    document.getElementById('quest-form')?.classList.add('hidden');
    document.getElementById('inventory-form')?.classList.add('hidden');

    // Mostrar u ocultar la barra de información de usuario
    const userInfoBar = document.getElementById('user-info-bar');
    const userDisplay = document.getElementById('current-user-display');
    
    if (currentUser) {
        userInfoBar.classList.remove('hidden');
        
        const statusText = isEditor ? ' (Editor)' : ' (Lector)';
        userDisplay.textContent = `Sesión: ${currentUser}${statusText}`;
        
        if (!isEditor) {
             userInfoBar.style.backgroundColor = 'rgba(121, 85, 72, 0.8)'; 
        } else {
             userInfoBar.style.backgroundColor = 'var(--color-madera)'; 
        }

    } else {
        userInfoBar.classList.add('hidden');
    }

    renderQuests(); 
    renderInventory();
    renderHistory();
}

// ==========================================================
// 4. FUNCIONES DE RESET, LOGGING Y RENDERIZADO
// ==========================================================

window.resetHistory = () => {
    if (!isEditor) {
        alert("Permiso denegado. Solo los editores pueden resetear el historial.");
        return;
    }
    if (confirm("¿Estás seguro de que quieres BORRAR PERMANENTEMENTE todo el historial del campamento?")) {
        campHistory = [];
        renderHistory();
        updateAllData(null, null, "History reset.");
        alert("Historial reseteado para todos.");
    }
};

async function initializeCamp() {
    // 1. Cargar la Whitelist
    await loadWhitelist();

    // 2. Cargar los datos desde el servidor (data.json)
    const serverData = await loadServerData();

    // 3. Inicializar las variables usando LocalStorage (si existe) o ServerData
    campLocation = getStorageData(STORAGE_KEYS.location, serverData);
    campMoney = getStorageData(STORAGE_KEYS.money, serverData);
    campQuests = getStorageData(STORAGE_KEYS.quests, serverData);
    campInventory = getStorageData(STORAGE_KEYS.inventory, serverData);
    campHistory = getStorageData(STORAGE_KEYS.history, serverData);

    // 4. Verificar permisos (igual que antes)
    if (localStorage.getItem(STORAGE_KEYS.isEditorLoggedIn) === 'true' && currentUser) {
        isEditor = allowedUsersList.includes(currentUser);
        if (!isEditor) { localStorage.removeItem(STORAGE_KEYS.isEditorLoggedIn); }
    } else {
        isEditor = false;
    }

    if (!currentUser) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    } else {
        document.getElementById('welcome-overlay').classList.add('hidden'); 
    }

    // 5. Renderizar
    renderLocation();
    renderMoney();
    renderQuests();
    renderInventory();
    renderHistory();
    updatePermissionsUI();

    const music = document.getElementById('background-music');
    if (music) {
        music.volume = 0.4;
        music.play().catch(e => console.log("Audio auto-play blocked."));
    }
}


const logHistory = (type, message) => {
    if (!Array.isArray(campHistory)) { campHistory = initialData.history; }
    
    const timestamp = new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    campHistory.unshift({ timestamp, type, message });
    if (campHistory.length > 50) campHistory.pop(); 
    // Nota: El setStorageData y el renderHistory se llaman dentro de updateAllData ahora
    renderHistory();
};

function getStatusColor(status) {
    switch (status) {
        case 'Nueva': return '#ffa500';
        case 'EnProgreso': return '#007bff';
        case 'Completada': return '#28a745';
        case 'Fallida': return '#dc3545';
        default: return 'var(--color-madera)';
    }
}

function renderLocation() {
    const locationElement = document.getElementById('current-location');
    if (locationElement) {
        const editButtonHtml = `<button class="edit-btn" onclick="toggleLocationEdit()"><i class="fas fa-pen"></i></button>`;
        locationElement.innerHTML = `${campLocation} ${editButtonHtml}`;
    }
}

function renderMoney() {
    if (!campMoney) campMoney = initialData.money; 
    document.getElementById('gold-amount').textContent = campMoney.gold;
    document.getElementById('silver-amount').textContent = campMoney.silver;
    document.getElementById('copper-amount').textContent = campMoney.copper;
}

function renderQuests() {
    const questListContainer = document.getElementById('quest-list');
    questListContainer.innerHTML = '';

    if (!Array.isArray(campQuests)) campQuests = initialData.quests;

    campQuests.forEach(quest => {
        const item = document.createElement('div');
        item.className = 'quest-item';
        item.style.borderLeftColor = getStatusColor(quest.status);
        
        const actionsHtml = isEditor ? `
            <div class="quest-actions">
                <button onclick="changeQuestStatus(${quest.id}, 'Completada')">✔️ Completada</button>
                <button onclick="changeQuestStatus(${quest.id}, 'EnProgreso')">⏳ En Progreso</button>
                <button onclick="changeQuestStatus(${quest.id}, 'Fallida')">❌ Fallida</button>
                <button onclick="deleteQuest(${quest.id})">🗑️ Eliminar</button>
            </div>
        ` : '';

        item.innerHTML = `
            <h3>${quest.title}</h3>
            <span class="quest-status status-${quest.status.replace(/\s/g, '')}">${quest.status.toUpperCase()}</span>
            <p><strong>Objetivo:</strong> ${quest.objective}</p>
            <p><strong>Recompensa:</strong> ${quest.reward}</p>
            ${actionsHtml}
        `;
        questListContainer.appendChild(item);
    });
}

function renderInventory() {
    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = '';

    if (!Array.isArray(campInventory)) campInventory = initialData.inventory;

    campInventory.forEach(item => {
        const listItem = document.createElement('li');
        const escapedItemName = item.name.replace(/'/g, "\\'"); 
        
        const removeButton = isEditor ? `<button class="item-remove" onclick="removeItem('${escapedItemName}')">&times;</button>` : '';

        listItem.innerHTML = `
            <span class="item-quantity">(${item.quantity}x)</span> ${item.name}
            ${removeButton}
        `;
        inventoryList.appendChild(listItem);
    });
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    const historyHeader = document.querySelector('.history-header');
    
    document.getElementById('reset-history-btn')?.remove();

    if (historyHeader && isEditor) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-history-btn';
        resetBtn.innerHTML = '<i class="fas fa-trash"></i> Resetear';
        resetBtn.onclick = window.resetHistory;
        historyHeader.appendChild(resetBtn);
    }
    
    historyList.innerHTML = '';

    if (!Array.isArray(campHistory)) campHistory = initialData.history;

    campHistory.forEach(entry => {
        const listItem = document.createElement('li');
        listItem.className = `hist-${entry.type}`;
        listItem.textContent = `[${entry.timestamp}] ${entry.message}`;
        historyList.appendChild(listItem);
    });
}

/** Alterna las clases 'hidden' y 'open' para mostrar/ocultar el historial */
window.toggleHistory = () => {
    const panel = document.getElementById('history-panel');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('open'), 10); 
    } else {
        panel.classList.remove('open');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
};

// ==========================================================
// 5. FUNCIONES DE EDICIÓN CON GUARDADO AUTOMÁTICO
// ==========================================================

window.toggleLocationEdit = () => {
    if (!isEditor) return;
    const form = document.getElementById('location-edit-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        document.getElementById('new-location-input').value = campLocation;
    }
};

window.saveLocation = () => {
    if (!isEditor) return;
    const input = document.getElementById('new-location-input').value.trim();
    if (input && input !== campLocation) {
        const message = `Ubicación cambiada de "${campLocation}" a: "${input}"`;
        campLocation = input;
        renderLocation(); 
        updateAllData('location', message, `Location update: ${input}`);
    }
    document.getElementById('location-edit-form').classList.add('hidden');
};

window.toggleMoneyEdit = () => {
    if (!isEditor) return;
    const form = document.getElementById('money-edit-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        document.getElementById('money-g').value = campMoney.gold;
        document.getElementById('money-s').value = campMoney.silver;
        document.getElementById('money-c').value = campMoney.copper;
    }
};

window.updateMoney = () => {
    if (!isEditor) return;
    const g = parseInt(document.getElementById('money-g').value) || 0;
    const s = parseInt(document.getElementById('money-s').value) || 0;
    const c = parseInt(document.getElementById('money-c').value) || 0;

    if (g !== campMoney.gold || s !== campMoney.silver || c !== campMoney.copper) {
        const logMessage = `Dinero actualizado. Nuevo saldo: ${g} O, ${s} P, ${c} B.`;
        campMoney = { gold: g, silver: s, copper: c };
        renderMoney(); 
        updateAllData('money', logMessage, "Money amount updated.");
    }
    document.getElementById('money-edit-form').classList.add('hidden');
};

window.toggleQuestForm = () => {
    if (!isEditor) return;
    document.getElementById('quest-form').classList.toggle('hidden');
};

window.addQuest = () => {
    if (!isEditor) return;
    const title = document.getElementById('quest-title').value.trim();
    const objective = document.getElementById('quest-objective').value.trim();
    const reward = document.getElementById('quest-reward').value.trim() || 'Sin Recompensa';

    if (title && objective) {
        const newId = campQuests.length > 0 ? Math.max(...campQuests.map(q => q.id)) + 1 : 1;
        campQuests.unshift({ id: newId, title, objective, reward, status: 'Nueva' });
        renderQuests(); 
        updateAllData('quest', `Nueva misión añadida: ${title}`, `Added quest: ${title}`);
        
        document.getElementById('quest-title').value = '';
        document.getElementById('quest-objective').value = '';
        document.getElementById('quest-reward').value = '';
        document.getElementById('quest-form').classList.add('hidden');
    }
};

window.changeQuestStatus = (id, newStatus) => {
    if (!isEditor) return;
    const questIndex = campQuests.findIndex(q => q.id === id);
    if (questIndex !== -1) {
        campQuests[questIndex].status = newStatus;
        renderQuests();
        const title = campQuests[questIndex].title;
        updateAllData('quest', `Misión "${title}" marcada como: ${newStatus}`, `Status update for quest: ${title}`);
    }
};

window.deleteQuest = (id) => {
    if (!isEditor) return;
    const questIndex = campQuests.findIndex(q => q.id === id);
    if (questIndex !== -1 && confirm(`¿Estás seguro de que quieres eliminar la misión "${campQuests[questIndex].title}"?`)) {
        const title = campQuests[questIndex].title;
        campQuests.splice(questIndex, 1);
        renderQuests();
        updateAllData('quest', `Misión eliminada: ${title}`, `Deleted quest: ${title}`);
    }
};

window.toggleInventoryForm = () => {
    if (!isEditor) return;
    document.getElementById('inventory-form').classList.toggle('hidden');
};

window.addItem = () => {
    if (!isEditor) return;
    const name = document.getElementById('item-name').value.trim();
    const quantity = parseInt(document.getElementById('item-quantity').value) || 1;

    if (name && quantity > 0) {
        const existingItem = campInventory.find(item => item.name.toLowerCase() === name.toLowerCase());
        
        let logMessage;
        if (existingItem) {
            existingItem.quantity += quantity;
            logMessage = `Añadidos ${quantity}x de ${name} (Total: ${existingItem.quantity})`;
        } else {
            campInventory.push({ name, quantity });
            logMessage = `Nueva mercancía añadida: ${quantity}x de ${name}`;
        }
        renderInventory();
        updateAllData('item', logMessage, `Added ${quantity}x of item: ${name}`);
        
        document.getElementById('item-name').value = '';
        document.getElementById('item-quantity').value = '1';
        document.getElementById('inventory-form').classList.add('hidden');
    }
};

window.removeItem = (itemName) => {
    if (!isEditor) return;
    const itemIndex = campInventory.findIndex(item => item.name === itemName);
    if (itemIndex !== -1) {
        const item = campInventory[itemIndex];
        const newQuantity = prompt(`¿Cuántos ${item.name} quieres quitar? (Total: ${item.quantity})`, item.quantity);
        
        const amountToRemove = parseInt(newQuantity);

        if (amountToRemove > 0) {
            if (amountToRemove >= item.quantity) {
                if (confirm(`Estás a punto de ELIMINAR todo el stack de ${item.name}. ¿Continuar?`)) {
                    campInventory.splice(itemIndex, 1);
                    updateAllData('item', `Mercancía ELIMINADA: ${item.quantity}x de ${itemName}`, `Removed item: ${itemName}`);
                }
            } else {
                item.quantity -= amountToRemove;
                updateAllData('item', `Gastados ${amountToRemove}x de ${itemName} (Quedan: ${item.quantity})`, `Used ${amountToRemove}x of item: ${itemName}`);
            }
            renderInventory();
        } else if (newQuantity !== null) {
            alert("Cantidad inválida o no se ha quitado nada.");
        }
    }
};


// ==========================================================
// 6. LLAMADA FINAL PARA INICIAR EL CAMPAMENTO
// ==========================================================
initializeCamp();