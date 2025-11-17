document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const speechToggle = document.getElementById('speechToggle');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const outputArea = document.getElementById('output');
    const historyBtn = document.getElementById('historyBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyContent = document.getElementById('historyContent');
    const mainContent = document.getElementById('mainContent');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const attachImageBtn = document.getElementById('attachImageBtn');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const speechControls = document.getElementById('speechControls');
    const pauseSpeechBtn = document.getElementById('pauseSpeechBtn');
    const resumeSpeechBtn = document.getElementById('resumeSpeechBtn');
    
    // --- API Configuration ---
    const API_KEY = 'AIzaSyDvEg_bwsZsnk2MsqDHdDNWA3Y1JnYYkgI';
    // --- THE FINAL, CORRECT, SINGLE MODEL FOR ALL TASKS ---
    // gemini-2.5-flash-lite is the correct free-tier model for both text and image.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
    
    // --- State ---
    let chatLog = [];
    let attachedImage = null;
    const synth = window.speechSynthesis;
    let currentUtterance = null;

    // --- Event Listeners ---
    darkModeToggle.addEventListener('change', setDarkMode);
    speechToggle.addEventListener('change', () => {
        localStorage.setItem('speechEnabled', speechToggle.checked);
        if (!speechToggle.checked) stopSpeech();
    });
    sendButton.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    historyBtn.addEventListener('click', toggleHistoryPanel);
    closeHistoryBtn.addEventListener('click', toggleHistoryPanel);
    clearHistoryBtn.addEventListener('click', clearChat);
    attachImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageAttachment);
    pauseSpeechBtn.addEventListener('click', () => synth.pause());
    resumeSpeechBtn.addEventListener('click', () => synth.resume());

    // --- Initialization ---
    function initialize() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        darkModeToggle.checked = isDarkMode;
        setDarkMode();
        const isSpeechEnabled = localStorage.getItem('speechEnabled') === 'true';
        speechToggle.checked = isSpeechEnabled;
        loadLog();
        renderChat();
        renderLog();
    }
    
    function setDarkMode() {
        document.documentElement.classList.toggle('dark-mode', darkModeToggle.checked);
        document.documentElement.classList.toggle('light-mode', !darkModeToggle.checked);
        localStorage.setItem('darkMode', darkModeToggle.checked);
    }
    
    initialize();

    // --- History/Log Functions ---
    function toggleHistoryPanel() { historyPanel.classList.toggle('open'); mainContent.classList.toggle('shifted'); }
    function loadLog() { chatLog = JSON.parse(localStorage.getItem('jeevaVerseLog')) || []; }
    function saveLog() { localStorage.setItem('jeevaVerseLog', JSON.stringify(chatLog)); }
    
    function clearChat() {
        stopSpeech();
        chatLog = [];
        saveLog();
        renderChat();
        renderLog();
        if (historyPanel.classList.contains('open')) {
            toggleHistoryPanel();
        }
    }

    function addToLog(role, content) {
        const timestamp = new Date();
        chatLog.push({ role, content, timestamp });
        saveLog();
        renderLog();
    }
    
    function renderChat() {
        outputArea.innerHTML = '';
        if (chatLog.length === 0) {
            addMessageToOutput({text: "Welcome to JeevaVerse. Attach an image or ask a question."}, 'ai-response');
        } else {
             chatLog.forEach(item => addMessageToOutput(item.content, item.role === 'user' ? 'user-prompt' : 'ai-response'));
        }
        outputArea.scrollTop = outputArea.scrollHeight;
    }
    
    function renderLog() {
        historyContent.innerHTML = '';
        [...chatLog].reverse().forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            const role = document.createElement('div');
            role.className = 'history-role';
            role.textContent = item.role === 'user' ? 'You' : 'JeevaVerse';
            const content = document.createElement('p');
            content.textContent = item.content.text;
            const time = document.createElement('div');
            time.className = 'timestamp';
            time.textContent = new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
            historyItem.append(role, content, time);
            historyContent.appendChild(historyItem);
        });
    }

    // --- Image Handling ---
    function handleImageAttachment(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            attachedImage = {
                mimeType: file.type,
                base64: reader.result.split(',')[1]
            };
            displayImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    }
    
    function displayImagePreview(imageDataUrl) {
        imagePreviewContainer.innerHTML = `
            <img src="${imageDataUrl}" class="image-preview" alt="Image preview">
            <button class="remove-image-btn">&times;</button>
        `;
        imagePreviewContainer.querySelector('.remove-image-btn').addEventListener('click', removeImage);
    }

    function removeImage() {
        attachedImage = null;
        imageInput.value = '';
        imagePreviewContainer.innerHTML = '';
    }

    // --- Core Functions ---
    async function handleSend() {
        const prompt = userInput.value.trim();
        if ((!prompt && !attachedImage) || sendButton.disabled) return;
        
        stopSpeech();
        const messageContent = { text: prompt, image: attachedImage ? imagePreviewContainer.querySelector('img').src : null };

        addMessageToOutput(messageContent, 'user-prompt');
        addToLog('user', messageContent);
        
        sendButton.disabled = true;
        addMessageToOutput({ text: '<span></span><span></span><span></span>' }, 'ai-response typing-indicator');
        
        try {
            const response = await callGeminiAPI(prompt, attachedImage);
            updateLastMessage({ text: response });
            addToLog('model', { text: response });
            if (speechToggle.checked) {
                speakText(response);
            }
        } catch (error) {
            const errorMessage = `An error occurred: ${error.message}`;
            updateLastMessage({ text: errorMessage });
            addToLog('model', { text: errorMessage });
        } finally {
            userInput.value = '';
            removeImage();
            sendButton.disabled = false;
        }
    }

    function addMessageToOutput(content, className) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = className;
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content.text;
        if(content.image) {
            const img = document.createElement('img');
            img.src = content.image;
            messageContent.appendChild(img);
        }
        messageWrapper.appendChild(messageContent);
        outputArea.appendChild(messageWrapper);
        outputArea.scrollTop = outputArea.scrollHeight;
    }
    
    function updateLastMessage(content) {
        const typingIndicator = outputArea.querySelector('.typing-indicator .message-content');
        if (typingIndicator) {
            typingIndicator.parentElement.classList.remove('typing-indicator');
            typingIndicator.innerHTML = content.text;
        } else {
            addMessageToOutput(content, 'ai-response');
        }
        outputArea.scrollTop = outputArea.scrollHeight;
    }
    
    // --- Speech Synthesis Functions ---
    function speakText(text) {
        const cleanText = text.replace(/[*_`~]/g, '');
        currentUtterance = new SpeechSynthesisUtterance(cleanText);
        currentUtterance.onstart = () => { if (speechToggle.checked) speechControls.style.display = 'flex'; };
        currentUtterance.onend = () => speechControls.style.display = 'none';
        currentUtterance.onerror = () => speechControls.style.display = 'none';
        synth.speak(currentUtterance);
    }
    
    function stopSpeech() {
        if (synth.speaking) synth.cancel();
        speechControls.style.display = 'none';
    }

    async function callGeminiAPI(prompt, image) {
        const parts = [];
        if (prompt) parts.push({ text: prompt });
        if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
        
        const payload = { contents: [{ parts: parts }] };

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error.message || 'An unknown API error occurred.');
        }

        const data = await res.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
             return data.candidates[0].content.parts[0].text;
        } else {
            return "I'm sorry, I couldn't generate a response for this. It may have been blocked due to safety policies.";
        }
    }
});