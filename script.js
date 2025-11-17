
const GEMINI_API_KEY_KEY = 'gemini_api_key';
const CHATS_KEY = 'gemini_chats';
const MASKS_KEY = 'gemini_masks';

// --- DOM Elements ---
const apiKeyContainer = document.getElementById('api-key-container');
const appContainer = document.getElementById('app-container');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const chatContainer = document.getElementById('chat-container');
const chatHeader = document.getElementById('chat-header');
const maskSelect = document.getElementById('mask-select');
const manageMasksBtn = document.getElementById('manage-masks-btn');
const maskModal = document.getElementById('mask-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const maskListContainer = document.getElementById('mask-list-container');
const maskIdInput = document.getElementById('mask-id-input');
const maskNameInput = document.getElementById('mask-name-input');
const maskPromptInput = document.getElementById('mask-prompt-input');
const saveMaskBtn = document.getElementById('save-mask-btn');
const deleteMaskBtn = document.getElementById('delete-mask-btn');
const newMaskBtn = document.getElementById('new-mask-btn');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyError = document.getElementById('api-key-error');
const chatHistory = document.getElementById('chat-history');
const suggestionsContainer = document.getElementById('suggestions-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// --- Modules ---
let marked;

const ApiKeyManager = {
    _apiKey: '',

    getApiKey() {
        if (!this._apiKey) {
            this._apiKey = localStorage.getItem(GEMINI_API_KEY_KEY);
        }
        return this._apiKey;
    },

    saveApiKey(apiKey) {
        if (!apiKey || apiKey.trim() === '') {
            apiKeyError.textContent = 'API 金鑰不能為空。';
            return false;
        }
        this._apiKey = apiKey;
        localStorage.setItem(GEMINI_API_KEY_KEY, apiKey);
        apiKeyError.textContent = '';
        return true;
    },

    clearApiKey() {
        this._apiKey = '';
        localStorage.removeItem(GEMINI_API_KEY_KEY);
    }
};

const UIManager = {
    showChatInterface() {
        apiKeyContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        messageInput.focus();
    },

    showApiKeyInterface() {
        appContainer.classList.add('hidden');
        apiKeyContainer.classList.remove('hidden');
        apiKeyInput.focus();
    },

    addMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);

        if (sender === 'model' && marked) {
            messageElement.innerHTML = marked.parse(message);
        } else {
            messageElement.textContent = message;
        }

        chatHistory.appendChild(messageElement);
        this.scrollToBottom();
    },

    scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    },

    startLoading() {
        sendBtn.disabled = true;
        sendBtn.textContent = '傳送中...';
    },

    stopLoading() {
        sendBtn.disabled = false;
        sendBtn.textContent = '傳送';
    },

    displaySuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.textContent = suggestion;
            button.addEventListener('click', () => {
                ChatManager.sendMessage(suggestion);
            });
            suggestionsContainer.appendChild(button);
        });
    },

    clearSuggestions() {
        suggestionsContainer.innerHTML = '';
    }
};

const MaskManager = {
    masks: {},
    currentMaskId: 'default',

    init() {
        this.loadMasks();
        this.renderMasks();
    },

    loadMasks() {
        const storedMasks = localStorage.getItem(MASKS_KEY);
        if (storedMasks) {
            this.masks = JSON.parse(storedMasks);
        } else {
            // Default masks
            this.masks = {
                'default': { name: '預設助理', prompt: '你是一個樂於助人的人工智慧助理。' },
                'translator': { name: '專業譯者', prompt: '你是一個專業的翻譯，請將任何語言的內容翻譯成繁體中文，內容要流暢、準確且在地化。' },
                'code_expert': { name: '程式碼專家', prompt: '你是一個專業的軟體工程師，精通各種程式語言和軟體架構，請用專業且簡潔的方式回答程式相關問題。' }
            };
            this.saveMasks();
        }
    },

    saveMasks() {
        localStorage.setItem(MASKS_KEY, JSON.stringify(this.masks));
    },

    renderMasks() {
        maskSelect.innerHTML = '';
        for (const id in this.masks) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = this.masks[id].name;
            if (id === this.currentMaskId) {
                option.selected = true;
            }
            maskSelect.appendChild(option);
        }
    },

    getCurrentMask() {
        return this.masks[this.currentMaskId];
    },

    switchMask(maskId) {
        this.currentMaskId = maskId;
    },

    openModal() {
        this.renderModalList();
        this.selectMaskInModal(Object.keys(this.masks)[0]); // Select the first mask by default
        maskModal.classList.remove('hidden');
    },

    closeModal() {
        maskModal.classList.add('hidden');
    },

    renderModalList() {
        maskListContainer.innerHTML = '';
        for (const id in this.masks) {
            const item = document.createElement('div');
            item.classList.add('mask-list-item');
            item.textContent = this.masks[id].name;
            item.dataset.id = id;
            item.addEventListener('click', () => this.selectMaskInModal(id));
            maskListContainer.appendChild(item);
        }
    },

    selectMaskInModal(id) {
        const selected = maskListContainer.querySelector('.selected');
        if (selected) {
            selected.classList.remove('selected');
        }

        const newSelection = maskListContainer.querySelector(`[data-id="${id}"]`);
        if (newSelection) {
            newSelection.classList.add('selected');
            const mask = this.masks[id];
            maskIdInput.value = id;
            maskNameInput.value = mask.name;
            maskPromptInput.value = mask.prompt;
            deleteMaskBtn.disabled = !id;
        }
    },

    clearEditForm() {
        maskIdInput.value = '';
        maskNameInput.value = '';
        maskPromptInput.value = '';
        maskNameInput.focus();
        const selected = maskListContainer.querySelector('.selected');
        if (selected) {
            selected.classList.remove('selected');
        }
    },

    saveMask() {
        const id = maskIdInput.value;
        const name = maskNameInput.value.trim();
        const prompt = maskPromptInput.value.trim();

        if (!name || !prompt) {
            alert('面具名稱和系統提示不能為空。');
            return;
        }

        if (id) { // Update existing mask
            this.masks[id] = { name, prompt };
        } else { // Create new mask
            const newId = `mask_${Date.now()}`;
            this.masks[newId] = { name, prompt };
            this.currentMaskId = newId;
        }

        this.saveMasks();
        this.renderMasks();
        this.renderModalList();
        this.selectMaskInModal(id || this.currentMaskId);
    },

    deleteMask() {
        const id = maskIdInput.value;
        if (id && confirm(`確定要刪除面具 "${this.masks[id].name}" 嗎？`)) {
            if (Object.keys(this.masks).length <= 1) {
                alert('無法刪除最後一個面具。');
                return;
            }
            delete this.masks[id];
            this.currentMaskId = Object.keys(this.masks)[0]; // Switch to the first available mask

            this.saveMasks();
            this.renderMasks();
            this.renderModalList();
            this.selectMaskInModal(this.currentMaskId);
        }
    }
};

const ChatManager = {
    chats: {},
    currentChatId: null,
    _model: null,

    async init() {
        this.loadChats();
        this.renderHistoryList();

        if (!this.currentChatId && Object.keys(this.chats).length > 0) {
            this.currentChatId = Object.keys(this.chats)[0];
        } else if (!this.currentChatId) {
            this.startNewChat();
        }

        this.renderCurrentChat();

        if (ApiKeyManager.getApiKey()) {
            try {
                const { GoogleGenerativeAI } = await import('https://esm.run/@google/generative-ai');
                const { marked: markedModule } = await import('https://esm.run/marked');
                marked = markedModule;

                const genAI = new GoogleGenerativeAI(ApiKeyManager.getApiKey());
                this._model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    generationConfig: {
                        maxOutputTokens: 4000
                    }
                });
                UIManager.showChatInterface();
            } catch (error) {
                console.error("初始化 Gemini 模型失敗:", error);
                ApiKeyManager.clearApiKey();
                UIManager.showApiKeyInterface();
                apiKeyError.textContent = 'API 金鑰無效或網路錯誤，請重新輸入。';
            }
        } else {
            UIManager.showApiKeyInterface();
        }
    },

    loadChats() {
        this.chats = JSON.parse(localStorage.getItem(CHATS_KEY)) || {};
    },

    saveChats() {
        localStorage.setItem(CHATS_KEY, JSON.stringify(this.chats));
    },

    startNewChat() {
        const newChatId = `chat_${Date.now()}`;
        this.chats[newChatId] = {
            history: [],
            title: '新的對話'
        };
        this.currentChatId = newChatId;
        this.renderCurrentChat();
        this.renderHistoryList();
        this.saveChats();
    },

    switchChat(chatId) {
        this.currentChatId = chatId;
        this.renderCurrentChat();
        this.renderHistoryList();
    },

    renderCurrentChat() {
        chatHistory.innerHTML = '';
        const currentChat = this.chats[this.currentChatId];
        if (currentChat) {
            currentChat.history.forEach(msg => UIManager.addMessage(msg.sender, msg.message));
        }
    },

    renderHistoryList() {
        historyList.innerHTML = '';
        Object.keys(this.chats).forEach(chatId => {
            const chat = this.chats[chatId];
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === this.currentChatId) {
                historyItem.classList.add('active');
            }
            historyItem.textContent = chat.title;
            historyItem.addEventListener('click', () => this.switchChat(chatId));
            historyList.appendChild(historyItem);
        });
    },

    async sendMessage(message) {
        if (!message || message.trim() === '') return;

        UIManager.clearSuggestions();
        const currentChat = this.chats[this.currentChatId];
        UIManager.addMessage('user', message);
        currentChat.history.push({ sender: 'user', message });

        if (currentChat.history.length === 1) { // First user message
            currentChat.title = message.substring(0, 30); // Set title
            this.renderHistoryList();
        }
        this.saveChats();

        UIManager.startLoading();

        try {
            if (!this._model) {
                 throw new Error("模型尚未初始化。");
            }

            const currentMask = MaskManager.getCurrentMask();
            const systemInstruction = {
                role: "system",
                parts: [{ text: currentMask.prompt }],
            };

            const chat = this._model.startChat({
                 history: currentChat.history.filter(m => m.sender === 'user' || m.sender === 'model').map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.message }]
                })),
                generationConfig: {
                    maxOutputTokens: 4000,
                },
                systemInstruction: systemInstruction,
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            const text = response.text();

            UIManager.addMessage('model', text);
            currentChat.history.push({ sender: 'model', message: text });
            this.saveChats();

        } catch (error) {
            console.error("訊息傳送失敗:", error);
            UIManager.addMessage('model', '抱歉，發生錯誤，無法取得回應。');
        } finally {
            UIManager.stopLoading();
        }

        this.generateSuggestions(message, text);
    },

    async generateSuggestions(userMessage, modelResponse) {
        try {
            const prompt = `基於以下對話：\n使用者: "${userMessage}"\nAI: "${modelResponse}"\n\n請生成三個相關的、可以讓使用者直接點擊發問的簡短問題建議。每個問題請用 '|' 分隔，不要有任何其他多餘的文字或編號。`;

            const result = await this._model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const suggestions = text.split('|').map(s => s.trim()).filter(s => s);
            UIManager.displaySuggestions(suggestions);

        } catch (error) {
            console.error("生成建議問題失敗:", error);
        }
    }
};


// --- Event Listeners ---

newChatBtn.addEventListener('click', () => {
    ChatManager.startNewChat();
});

maskSelect.addEventListener('change', (e) => {
    MaskManager.switchMask(e.target.value);
});

manageMasksBtn.addEventListener('click', () => {
    MaskManager.openModal();
});

closeModalBtn.addEventListener('click', () => {
    MaskManager.closeModal();
});

newMaskBtn.addEventListener('click', () => {
    MaskManager.clearEditForm();
});

saveMaskBtn.addEventListener('click', () => {
    MaskManager.saveMask();
});

deleteMaskBtn.addEventListener('click', () => {
    MaskManager.deleteMask();
});

saveApiKeyBtn.addEventListener('click', () => {
    if (ApiKeyManager.saveApiKey(apiKeyInput.value)) {
        ChatManager.init();
    }
});

apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveApiKeyBtn.click();
    }
});

sendBtn.addEventListener('click', () => {
    const message = messageInput.value;
    ChatManager.sendMessage(message);
    messageInput.value = '';
    messageInput.focus();
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// --- Initialization ---
MaskManager.init();
ChatManager.init();
