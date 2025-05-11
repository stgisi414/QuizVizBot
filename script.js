
const API_KEY = "AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA";
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

// Load chat history from localStorage
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');

function displayMessages() {
  messagesContainer.innerHTML = '';
  chatHistory.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = msg.text;
    messagesContainer.appendChild(messageDiv);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display existing messages
displayMessages();

function addMessage(message, isUser) {
  chatHistory.push({ text: message, isUser });
  if (chatHistory.length > 10) {
    chatHistory.shift();
  }
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  displayMessages();
}

async function getBotResponse(userMessage) {
  const currentLocalDate = new Date().toLocaleString();
  const contextMessages = chatHistory.map(msg => 
    `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`
  ).join('\n');
  const messageWithContext = `Previous conversation:\n${contextMessages}\n\nUser: ${userMessage}\nCurrent time: ${currentLocalDate}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: messageWithContext }]
        }]
      })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage(message, true);
  userInput.value = '';

  const botResponse = await getBotResponse(message);
  addMessage(botResponse, false);
}

function resetChat() {
  chatHistory = [];
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  messagesContainer.innerHTML = '';
}

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
