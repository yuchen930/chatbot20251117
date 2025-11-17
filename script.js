const { GoogleGenerativeAI } = self.genai;

// --- DOM Elements Store ---
const a = {};

// --- Global State ---
let genAI;
let chat;
let apiKey;
let chatHistory = {};
let currentChatId = null;
let masks = {};

// --- Core Application Logic ---

function initializeDOM() {
    a.apiKeyContainer = document.getElementById('api-key-container');
    a.chatContainer = document.getElementById('chat-container');
    a.apiKeyInput = document.getElementById('api-key-input');
    a.saveApiKeyBtn = document.getElementById('save-api-key-btn');
    a.sidebar = document.getElementById('sidebar');
    a.menuBtn = document.getElementById('menu-btn');
    a.overlay = document.getElementById('overlay');
    a.newChatBtn = document.getElementById('new-chat-btn');
    a.historyList = document.getElementById('history-list');
    a.maskSelect = document.getElementById('mask-select');
    a.addMaskBtn = document.getElementById('add-mask-btn');
    a.chatMessages = document.getElementById('chat-messages');
    a.suggestedQuestionsContainer = document.getElementById('suggested-questions');
    a.messageInput = document.getElementById('message-input');
    a.sendBtn = document.getElementById('send-btn');
    a.addMaskModal = document.getElementById('add-mask-modal');
    a.maskNameInput = document.getElementById('mask-name-input');
    a.maskPromptInput = document.getElementById('mask-prompt-input');
    a.saveMaskBtn = document.getElementById('save-mask-btn');
    a.cancelMaskBtn = document.getElementById('cancel-mask-btn');
}

function attachEventListeners() {
    a.saveApiKeyBtn.addEventListener('click', handleApiKeySave);
    a.newChatBtn.addEventListener('click', () => startNewChat());
    a.maskSelect.addEventListener('change', () => startNewChat());
    a.addMaskBtn.addEventListener('click', () => a.addMaskModal.classList.remove('hidden'));
    a.cancelMaskBtn.addEventListener('click', () => a.addMaskModal.classList.add('hidden'));
    a.saveMaskBtn.addEventListener('click', saveNewMask);
    a.sendBtn.addEventListener('click', sendMessage);
    a.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    a.menuBtn.addEventListener('click', toggleSidebar);
    a.overlay.addEventListener('click', toggleSidebar);
}

async function initializeApp() {
    apiKey = localStorage.getItem('gemini-api-key');
    loadMasks();
    loadChatHistory();

    if (apiKey) {
        try {
            genAI = new GoogleGenerativeAI(apiKey);
            showChatInterface();
            const latestChatId = Object.keys(chatHistory).length > 0
                ? Object.keys(chatHistory).sort((a, b) => b.split('_')[1] - a.split('_')[1])[0]
                : null;

            if (latestChatId) {
                loadChat(latestChatId);
            } else {
                startNewChat();
            }
        } catch (error) {
            console.error("Failed to initialize GoogleGenerativeAI:", error);
            handleApiKeyError();
        }
    } else {
        showApiKeyScreen();
    }
}

// --- UI State Management ---

function showChatInterface() {
    a.apiKeyContainer.classList.add('hidden');
    a.chatContainer.classList.remove('hidden');
}

function showApiKeyScreen() {
    a.chatContainer.classList.add('hidden');
    a.apiKeyContainer.classList.remove('hidden');
}

function toggleSidebar() {
    a.sidebar.classList.toggle('open');
    a.overlay.classList.toggle('hidden');
}

// --- Event Handlers ---

function handleApiKeySave() {
    const key = a.apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini-api-key', key);
        a.apiKeyInput.value = '';
        initializeApp();
    } else {
        alert('請輸入您的 API 金鑰。');
    }
}

function handleApiKeyError() {
    alert("API 金鑰似乎無效或已過期，請重新設定。");
    localStorage.removeItem('gemini-api-key');
    showApiKeyScreen();
}

// --- Data Persistence (localStorage) ---

function saveChatHistory() {
    localStorage.setItem('gemini-chat-history', JSON.stringify(chatHistory));
}

function loadChatHistory() {
    const history = localStorage.getItem('gemini-chat-history');
    chatHistory = history ? JSON.parse(history) : {};
    renderHistoryList();
}

function saveMasks() {
    localStorage.setItem('gemini-chat-masks', JSON.stringify(masks));
}

function loadMasks() {
    const storedMasks = localStorage.getItem('gemini-chat-masks');
    masks = storedMasks ? JSON.parse(storedMasks) : { 'default': { name: '預設', prompt: '' } };
    renderMaskOptions();
}

// --- Chat & Mask Logic ---

function saveNewMask() {
    const name = a.maskNameInput.value.trim();
    const prompt = a.maskPromptInput.value.trim();
    if (name && prompt) {
        const id = `mask_${Date.now()}`;
        masks[id] = { name, prompt };
        saveMasks();
        renderMaskOptions();
        a.maskSelect.value = id;
        a.addMaskModal.classList.add('hidden');
        a.maskNameInput.value = '';
        a.maskPromptInput.value = '';
    } else {
        alert('請輸入面具名稱和系統提示。');
    }
}

function startNewChat(history = []) {
    if (!genAI) return;

    if (history.length === 0) {
        currentChatId = `chat_${Date.now()}`;
        chatHistory[currentChatId] = [];
        saveChatHistory();
    }

    const selectedMaskId = a.maskSelect.value;
    const systemInstruction = masks[selectedMaskId]?.prompt || '';

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction,
    });

    chat = model.startChat({
        history: history,
        generationConfig: { maxOutputTokens: 4000 },
    });

    renderChatMessages();
    renderHistoryList();
}

async function sendMessage() {
    const messageText = a.messageInput.value.trim();
    if (!messageText || !currentChatId) return;

    const userMessage = { role: 'user', parts: [{ text: messageText }] };
    chatHistory[currentChatId].push(userMessage);

    appendMessage(messageText, 'user');
    a.messageInput.value = '';
    a.suggestedQuestionsContainer.innerHTML = '';

    showTypingIndicator();

    try {
        const result = await chat.sendMessage(messageText);
        const modelMessage = { role: 'model', parts: [{ text: result.response.text() }] };
        chatHistory[currentChatId].push(modelMessage);

        saveChatHistory();
        renderHistoryList();

        removeTypingIndicator();
        appendMessage(modelMessage.parts[0].text, 'model');
        generateSuggestedQuestions(messageText, modelMessage.parts[0].text);

    } catch (error) {
        console.error("Error sending message:", error);
        removeTypingIndicator();
        appendMessage(`發生錯誤： ${error.message}`, 'model', true);
    }
}

// --- UI Rendering ---

function renderHistoryList() {
    a.historyList.innerHTML = '';
    Object.keys(chatHistory).sort((b, a) => a.split('_')[1] - b.split('_')[1]).forEach(id => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item');
        historyItem.dataset.id = id;
        const firstUserMessage = chatHistory[id].find(m => m.role === 'user');
        historyItem.textContent = firstUserMessage ? firstUserMessage.parts[0].text : '新的對話';
        if (id === currentChatId) {
            historyItem.classList.add('active');
        }
        historyItem.addEventListener('click', () => {
            loadChat(id);
            if (window.innerWidth <= 768 && a.sidebar.classList.contains('open')) {
                toggleSidebar();
            }
        });
        a.historyList.appendChild(historyItem);
    });
}

function loadChat(id) {
    if (!chatHistory[id]) return;
    currentChatId = id;
    startNewChat(chatHistory[id]);
}

function renderMaskOptions() {
    a.maskSelect.innerHTML = '';
    for (const id in masks) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = masks[id].name;
        a.maskSelect.appendChild(option);
    }
}

function renderChatMessages() {
    a.chatMessages.innerHTML = '';
    if (chatHistory[currentChatId] && chatHistory[currentChatId].length > 0) {
        chatHistory[currentChatId].forEach(msg => {
            appendMessage(msg.parts[0].text, msg.role);
        });
    } else {
         a.chatMessages.innerHTML = '<div class="message model"><p>您好！我是 Gemini，請問有什麼可以幫助您的嗎？</p></div>';
         a.suggestedQuestionsContainer.innerHTML = '';
    }
}

function appendMessage(text, role, isError = false) {
    const messageElement = document.createElement('div');
    const sender = role === 'user' ? 'user' : 'model';
    messageElement.classList.add('message', sender);

    if (isError) {
        messageElement.style.backgroundColor = 'var(--error-color)';
        messageElement.innerHTML = `<p>${text}</p>`;
    } else if (sender === 'model') {
        messageElement.innerHTML = marked.parse(text);
    } else {
        const p = document.createElement('p');
        p.textContent = text;
        messageElement.appendChild(p);
    }

    a.chatMessages.appendChild(messageElement);
    scrollToBottom();
}

function showTypingIndicator() {
    let indicator = a.chatMessages.querySelector('.typing-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.classList.add('message', 'model', 'typing-indicator');
        indicator.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        a.chatMessages.appendChild(indicator);
        addTypingIndicatorStyles();
    }
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = a.chatMessages.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    a.chatMessages.scrollTop = a.chatMessages.scrollHeight;
}

// --- Suggested Questions ---

async function generateSuggestedQuestions(userQuery, modelResponse) {
    if (!genAI) return;

    const prompt = `基於以下使用者問題與 AI 回應，請生成三個簡短、相關且引人深思的後續問題建議。直接回傳三個問題，每個問題用換行符號分隔，不要包含編號或任何其他文字。\n\n使用者問題: "${userQuery}"\nAI 回應: "${modelResponse.substring(0, 500)}..."`;

    try {
        const suggestionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await suggestionModel.generateContent(prompt);
        const text = result.response.text();
        const questions = text.split('\n').filter(q => q.trim() !== '');
        displaySuggestedQuestions(questions.slice(0, 3));
    } catch (error) {
        console.error("Error generating suggested questions:", error);
    }
}

function displaySuggestedQuestions(questions) {
    a.suggestedQuestionsContainer.innerHTML = '';
    questions.forEach(q => {
        const button = document.createElement('button');
        button.textContent = q.trim().replace(/^- /, '');
        button.addEventListener('click', () => {
            a.messageInput.value = button.textContent;
            sendMessage();
        });
        a.suggestedQuestionsContainer.appendChild(button);
    });
}

// --- Utility Functions ---

function addTypingIndicatorStyles() {
    if (document.getElementById('typing-indicator-styles')) return;
    const styleSheet = document.createElement("style");
    styleSheet.id = 'typing-indicator-styles';
    styleSheet.innerText = `.typing-indicator .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: var(--text-secondary); animation: wave 1.3s linear infinite; } .typing-indicator .dot:nth-child(2) { animation-delay: -1.1s; } .typing-indicator .dot:nth-child(3) { animation-delay: -0.9s; } @keyframes wave { 0%, 60%, 100% { transform: initial; } 30% { transform: translateY(-10px); } }`;
    document.head.appendChild(styleSheet);
}

// --- Application Entry Point ---

document.addEventListener('DOMContentLoaded', () => {
    initializeDOM();
    attachEventListeners();
    initializeApp();
});
