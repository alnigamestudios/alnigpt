// ===== Configuration =====
const API_MODELS = {
    'gpt-5.1-thinking': 'https://hub.malson.eu/api/products/deepseek_ai/chat/completions/openai/gpt-5.1-thinking',
    'gpt-5.1-chat': 'https://hub.malson.eu/api/products/deepseek_ai/chat/completions/openai/gpt-5.1-chat',
    'gpt-4o': 'https://hub.malson.eu/api/products/deepseek_ai/chat/completions/openai/gpt-4o',
    'claude-opus-4.5': 'https://hub.malson.eu/api/products/deepseek_ai/chat/completions/anthropic/claude-opus-4.5',
    'gemini-3-pro': 'https://hub.malson.eu/api/products/deepseek_ai/chat/completions/google/gemini-3-pro'
};

let selectedModel = 'gpt-5.1-thinking';

const firebaseConfig = {
    apiKey: "AIzaSyBIPiJTeJ94kMvYo6AfoTTytNKxQWmysHE",
    authDomain: "alnigpt.firebaseapp.com",
    projectId: "alnigpt",
    storageBucket: "alnigpt.firebasestorage.app",
    messagingSenderId: "133490124908",
    appId: "1:133490124908:web:521345f691fb2c5fde9049",
    measurementId: "G-T9GGJDJ17Y"
};

const CLOUDINARY_CONFIG = {
    cloudName: 'dzazqlyq1',
    uploadPreset: 'alnigpt'
};

// ===== Initialize Firebase =====
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== State =====
let currentUser = null;
let conversations = [];
let currentConversationId = null;
let isGenerating = false;
let attachments = [];
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;

// ===== DOM Elements =====
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const loadingOverlay = document.getElementById('loadingOverlay');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const newChatBtn = document.getElementById('newChatBtn');
const newChatMobile = document.getElementById('newChatMobile');
const chatHistory = document.getElementById('chatHistory');
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');

const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageInput = document.getElementById('imageInput');
const attachmentPreview = document.getElementById('attachmentPreview');
const recordAudioBtn = document.getElementById('recordAudioBtn');
const recordingModal = document.getElementById('recordingModal');
const recordingTime = document.getElementById('recordingTime');
const cancelRecording = document.getElementById('cancelRecording');
const sendRecording = document.getElementById('sendRecording');

// ===== Initialize =====
function init() {
    setupAuthListeners();
    setupEventListeners();
}

// ===== Auth State Listener =====
function setupAuthListeners() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            showLoading();
            await loadUserData();
            await loadConversations();
            hideLoading();
            showApp();
        } else {
            currentUser = null;
            conversations = [];
            showAuth();
        }
    });
}

// ===== Auth Functions =====
function showLogin() {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginError.textContent = '';
}

function showRegister() {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerError.textContent = '';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        showLoading();
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        loginError.textContent = getErrorMessage(error.code);
        hideLoading();
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        showLoading();
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);

        // Update profile with name
        await userCredential.user.updateProfile({
            displayName: name
        });

        // Create user document in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
        registerError.textContent = getErrorMessage(error.code);
        hideLoading();
    }
});

function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
        'auth/invalid-email': 'Geçersiz e-posta adresi.',
        'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
        'auth/user-not-found': 'Kullanıcı bulunamadı.',
        'auth/wrong-password': 'Yanlış şifre.',
        'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.',
        'auth/invalid-credential': 'Geçersiz e-posta veya şifre.'
    };
    return messages[code] || 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;

    const icon = type === 'password'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    btn.innerHTML = icon;
}

// Make togglePassword globally available
window.togglePassword = togglePassword;
window.showLogin = showLogin;
window.showRegister = showRegister;

// ===== Load User Data =====
async function loadUserData() {
    if (currentUser) {
        userName.textContent = currentUser.displayName || currentUser.email.split('@')[0];
    }
}

// ===== Load Conversations from Firestore =====
async function loadConversations() {
    if (!currentUser) return;

    try {
        const snapshot = await db.collection('users')
            .doc(currentUser.uid)
            .collection('conversations')
            .orderBy('updatedAt', 'desc')
            .get();

        conversations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderChatHistory();
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// ===== Save Conversation to Firestore =====
async function saveConversation(conversation) {
    if (!currentUser) return;

    try {
        const docRef = db.collection('users')
            .doc(currentUser.uid)
            .collection('conversations')
            .doc(conversation.id);

        await docRef.set({
            title: conversation.title,
            messages: conversation.messages,
            createdAt: conversation.createdAt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving conversation:', error);
    }
}

// ===== Delete Conversation from Firestore =====
async function deleteConversationFromDB(id) {
    if (!currentUser) return;

    try {
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('conversations')
            .doc(id)
            .delete();
    } catch (error) {
        console.error('Error deleting conversation:', error);
    }
}

// ===== UI Functions =====
function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    messageInput.focus();
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Sidebar toggle
    menuBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // New chat
    newChatBtn.addEventListener('click', startNewChat);
    newChatMobile.addEventListener('click', () => {
        startNewChat();
        closeSidebar();
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Input handling
    messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateSendButton();
    });

    // Model selector
    modelSelect.addEventListener('change', (e) => {
        selectedModel = e.target.value;
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
    });

    // Image upload
    uploadImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);

    // Audio recording
    recordAudioBtn.addEventListener('click', startRecording);
    cancelRecording.addEventListener('click', cancelAudioRecording);
    sendRecording.addEventListener('click', sendAudioRecording);
}

function updateSendButton() {
    const hasText = messageInput.value.trim() !== '';
    const hasAttachments = attachments.length > 0;
    sendBtn.disabled = (!hasText && !hasAttachments) || isGenerating;
}

// ===== Sidebar Functions =====
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// ===== Chat History =====
function renderChatHistory() {
    chatHistory.innerHTML = '';

    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-history-item ${conv.id === currentConversationId ? 'active' : ''}`;
        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-title">${escapeHtml(conv.title)}</span>
            <button class="delete-btn" onclick="event.stopPropagation(); handleDeleteConversation('${conv.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
        item.addEventListener('click', () => loadConversation(conv.id));
        chatHistory.appendChild(item);
    });
}

// Make delete handler global
window.handleDeleteConversation = async function (id) {
    await deleteConversationFromDB(id);
    conversations = conversations.filter(c => c.id !== id);

    if (currentConversationId === id) {
        startNewChat();
    }

    renderChatHistory();
};

// ===== Conversation Management =====
function startNewChat() {
    currentConversationId = null;
    attachments = [];
    attachmentPreview.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    messagesContainer.classList.remove('active');
    messagesContainer.innerHTML = '';
    messageInput.value = '';
    messageInput.focus();
    renderChatHistory();
}

function loadConversation(id) {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;

    currentConversationId = id;
    welcomeScreen.style.display = 'none';
    messagesContainer.classList.add('active');
    messagesContainer.innerHTML = '';

    conversation.messages.forEach(msg => {
        appendMessage(msg.role, msg.content, msg.attachments, false);
    });

    renderChatHistory();
    closeSidebar();
    scrollToBottom();
}

function generateId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateTitle(message) {
    const title = message.slice(0, 40);
    return title.length < message.length ? title + '...' : title;
}

// ===== Image Upload =====
function handleImageSelect(e) {
    const files = e.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                attachments.push({
                    type: 'image',
                    data: event.target.result,
                    file: file
                });
                renderAttachments();
                updateSendButton();
            };
            reader.readAsDataURL(file);
        }
    });

    imageInput.value = '';
}

function renderAttachments() {
    attachmentPreview.innerHTML = '';

    attachments.forEach((attachment, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        if (attachment.type === 'image') {
            item.innerHTML = `
                <img src="${attachment.data}" alt="Attachment">
                <button class="remove-btn" onclick="removeAttachment(${index})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
        } else if (attachment.type === 'audio') {
            item.innerHTML = `
                <audio controls src="${attachment.url}"></audio>
                <button class="remove-btn" onclick="removeAttachment(${index})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
        }

        attachmentPreview.appendChild(item);
    });
}

window.removeAttachment = function (index) {
    attachments.splice(index, 1);
    renderAttachments();
    updateSendButton();
};

// ===== Audio Recording =====
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        recordingModal.classList.remove('hidden');
        updateRecordingTime();
        recordingTimer = setInterval(updateRecordingTime, 1000);

    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Mikrofona erişilemedi. Lütfen izin verin.');
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    recordingTime.textContent = `${minutes}:${seconds}`;
}

function cancelAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    clearInterval(recordingTimer);
    recordingModal.classList.add('hidden');
    audioChunks = [];
}

async function sendAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    clearInterval(recordingTimer);
    recordingModal.classList.add('hidden');

    // Wait for the last data
    await new Promise(resolve => setTimeout(resolve, 100));

    if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

        showLoading();
        try {
            const audioUrl = await uploadToCloudinary(audioBlob, 'video'); // Cloudinary uses 'video' for audio
            attachments.push({
                type: 'audio',
                url: audioUrl
            });
            renderAttachments();
            updateSendButton();
        } catch (error) {
            console.error('Error uploading audio:', error);
            alert('Ses yüklenirken hata oluştu.');
        }
        hideLoading();
    }

    audioChunks = [];
}

// ===== Cloudinary Upload =====
async function uploadToCloudinary(file, resourceType = 'image') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        {
            method: 'POST',
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
}

// ===== Build prompt from conversation history =====
function buildPrompt(messages) {
    let prompt = '';
    messages.forEach(msg => {
        if (msg.role === 'user') {
            let userContent = msg.content || '';
            // Görsel URL'lerini prompt'a ekle
            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(att => {
                    if (att.type === 'image') {
                        userContent += `\n[Görsel: ${att.url}]`;
                    } else if (att.type === 'audio') {
                        userContent += `\n[Ses kaydı: ${att.url}]`;
                    }
                });
            }
            prompt += `Kullanıcı: ${userContent}\n`;
        } else if (msg.role === 'assistant') {
            prompt += `Asistan: ${msg.content}\n`;
        }
    });
    return prompt.trim();
}

// ===== Message Functions =====
async function sendMessage() {
    const message = messageInput.value.trim();
    if ((!message && attachments.length === 0) || isGenerating) return;

    isGenerating = true;
    sendBtn.disabled = true;

    const currentAttachments = [...attachments];
    attachments = [];
    attachmentPreview.innerHTML = '';
    messageInput.value = '';
    autoResizeTextarea();

    // Hide welcome screen and show messages
    welcomeScreen.style.display = 'none';
    messagesContainer.classList.add('active');

    // Create new conversation if needed
    if (!currentConversationId) {
        const newConversation = {
            id: generateId(),
            title: generateTitle(message || 'Yeni Sohbet'),
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        conversations.unshift(newConversation);
        currentConversationId = newConversation.id;
        renderChatHistory();
    }

    // Upload images to Cloudinary
    const uploadedAttachments = [];
    for (const attachment of currentAttachments) {
        if (attachment.type === 'image' && attachment.file) {
            showLoading();
            try {
                const url = await uploadToCloudinary(attachment.file, 'image');
                uploadedAttachments.push({ type: 'image', url });
            } catch (error) {
                console.error('Error uploading image:', error);
            }
            hideLoading();
        } else if (attachment.type === 'audio') {
            uploadedAttachments.push(attachment);
        }
    }

    // Add user message
    const conversation = conversations.find(c => c.id === currentConversationId);
    const userMessage = {
        role: 'user',
        content: message,
        attachments: uploadedAttachments
    };
    conversation.messages.push(userMessage);
    await saveConversation(conversation);

    appendMessage('user', message, uploadedAttachments);
    scrollToBottom();

    // Show typing indicator
    const typingIndicator = appendTypingIndicator();

    try {
        // Build prompt from conversation history (now includes image URLs)
        let prompt = buildPrompt(conversation.messages);

        // Call API with selected model
        const apiUrl = API_MODELS[selectedModel];
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt
            }),
            redirect: 'follow',
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const text = await response.text();
        const assistantMessage = parseSSEResponse(text);

        typingIndicator.remove();

        if (assistantMessage) {
            const aiMessage = {
                role: 'assistant',
                content: assistantMessage,
                attachments: []
            };
            conversation.messages.push(aiMessage);
            await saveConversation(conversation);
            renderChatHistory();

            appendMessage('assistant', assistantMessage, []);
            scrollToBottom();
        } else {
            throw new Error('Yanıt boş geldi');
        }

    } catch (error) {
        console.error('API Error:', error);
        console.error('Selected Model:', selectedModel);
        console.error('API URL:', API_MODELS[selectedModel]);
        typingIndicator.remove();

        const errorMessage = `Üzgünüm, ${selectedModel} modelinde bir hata oluştu: ${error.message}`;
        appendMessage('assistant', errorMessage, []);

        conversation.messages.pop();
        await saveConversation(conversation);
    }

    isGenerating = false;
    updateSendButton();
    messageInput.focus();
}

// ===== Parse SSE Response =====
function parseSSEResponse(text) {
    const lines = text.split('\n');
    let contentParts = [];
    let isContentEvent = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line === 'event: content') {
            isContentEvent = true;
            continue;
        }

        if (isContentEvent && line.startsWith('data: ')) {
            try {
                const data = line.substring(6);
                if (!data.includes('<START_STREAMING_SSE>') && !data.includes('<END_STREAMING_SSE>') && !data.includes('{')) {
                    const parsed = JSON.parse(data);
                    if (typeof parsed === 'string') {
                        contentParts.push(parsed);
                    }
                }
            } catch (e) {
                // Not valid JSON, skip
            }
            isContentEvent = false;
        }
    }

    let fullContent = contentParts.join('');
    fullContent = fixTurkishEncoding(fullContent);

    return fullContent;
}

// ===== Fix Turkish Character Encoding =====
function fixTurkishEncoding(text) {
    const replacements = {
        'Ä±': 'ı',
        'Ä°': 'İ',
        'Ã¶': 'ö',
        'Ã–': 'Ö',
        'Ã¼': 'ü',
        'Ãœ': 'Ü',
        'ÅŸ': 'ş',
        'Åž': 'Ş',
        'ÄŸ': 'ğ',
        'Äž': 'Ğ',
        'Ã§': 'ç',
        'Ã‡': 'Ç',
        'Ä': 'ı',
        'Å': 'ş',
        'ð': '😊',
    };

    let fixed = text;
    for (const [bad, good] of Object.entries(replacements)) {
        fixed = fixed.split(bad).join(good);
    }

    return fixed;
}

function appendMessage(role, content, attachments = [], animate = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    if (!animate) messageDiv.style.animation = 'none';

    const avatarIcon = role === 'user'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>';

    let attachmentsHtml = '';
    if (attachments && attachments.length > 0) {
        attachmentsHtml = '<div class="message-attachments">';
        attachments.forEach(att => {
            if (att.type === 'image') {
                attachmentsHtml += `<img src="${att.url}" alt="Görsel" class="message-image">`;
            } else if (att.type === 'audio') {
                attachmentsHtml += `<audio controls src="${att.url}" class="message-audio"></audio>`;
            }
        });
        attachmentsHtml += '</div>';
    }

    const formattedContent = formatMessage(content);
    const hasContent = content && content.trim().length > 0;

    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">
                ${avatarIcon}
            </div>
            <div class="message-body">
                ${attachmentsHtml}
                ${hasContent ? `<div class="message-text">${formattedContent}</div>` : ''}
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
}

function appendTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'message assistant typing';
    indicatorDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
            </div>
            <div class="message-text">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(indicatorDiv);
    scrollToBottom();
    return indicatorDiv;
}

// ===== Formatting =====
function formatMessage(content) {
    if (!content) return '';

    let formatted = escapeHtml(content);

    // Code blocks
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Lists
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Numbered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    return formatted;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Utilities =====
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ===== Start Application =====
init();
