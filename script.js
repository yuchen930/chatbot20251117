
const GEMINI_API_KEY_KEY = 'gemini_api_key';
const CHAT_HISTORY_KEY = 'chat_history';

// --- DOM Elements ---
const apiKeyContainer = document.getElementById('api-key-container');
const chatContainer = document.getElementById('chat-container');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyError = document.getElementById('api-key-error');
const chatHistory = document.getElementById('chat-history');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// --- Modules ---

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
        chatContainer.classList.remove('hidden');
        messageInput.focus();
    },

    showApiKeyInterface() {
        chatContainer.classList.add('hidden');
        apiKeyContainer.classList.remove('hidden');
        apiKeyInput.focus();
    },

    addMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = message;
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
    }
};

const ChatManager = {
    _history: [],
    _model: null,

    async init() {
        this._history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || [];
        this._history.forEach(msg => UIManager.addMessage(msg.sender, msg.message));

        if (ApiKeyManager.getApiKey()) {
            try {
                const { GoogleGenerativeAI } = await import('https://esm.run/@google/generative-ai');
                const genAI = new GoogleGenerativeAI(ApiKeyManager.getApiKey());
                this._model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
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

    async sendMessage(message) {
        if (!message || message.trim() === '') return;

        UIManager.addMessage('user', message);
        this._history.push({ sender: 'user', message });
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(this._history));

        UIManager.startLoading();

        try {
            if (!this._model) {
                 throw new Error("模型尚未初始化。");
            }
            const chat = this._model.startChat({
                 history: this._history.filter(m => m.sender === 'user' || m.sender === 'model').map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.message }]
                })),
                generationConfig: {
                    maxOutputTokens: 4000,
                },
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            const text = response.text();

            UIManager.addMessage('model', text);
            this._history.push({ sender: 'model', message: text });
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(this._history));

        } catch (error) {
            console.error("訊息傳送失敗:", error);
            UIManager.addMessage('model', '抱歉，發生錯誤，無法取得回應。');
        } finally {
            UIManager.stopLoading();
        }
    }
};


// --- Event Listeners ---

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
ChatManager.init();
