
const API_KEY = "AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA";
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

let chatHistory = [];
let currentStep = 0;

const surveyFlow = {
  steps: [
    { type: "name", required: true },
    { type: "interests", required: true },
    { type: "goals", required: true },
    { type: "learning_style", required: true },
    { type: "open", required: false }
  ]
};

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

// Initialize chat with welcome message
async function initializeChat() {
  const welcomeMessage = await getBotResponse("", true);
  addMessage(welcomeMessage, false);
}

initializeChat();

function addMessage(message, isUser) {
  chatHistory.push({ text: message, isUser });
  if (chatHistory.length > 10) {
    chatHistory.shift();
  }
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  displayMessages();
}

async function getBotResponse(userMessage, isFirstMessage = false) {
  const contextMessages = chatHistory.map(msg => 
    `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`
  ).join('\n');

  const currentStep = surveyFlow.steps[chatHistory.filter(msg => !msg.isUser).length] || { type: "open" };
  
  const promptTemplate = isFirstMessage ? 
    `You are an educational AI assistant conducting a personalized learning journey. Provide a warm, engaging welcome message that introduces yourself and asks for the user's name. Keep it concise and friendly.` :
    `You are an educational AI assistant guiding a learning journey.
    Current step type: ${currentStep.type}
    Previous conversation: ${contextMessages}
    User message: ${userMessage}
    
    Based on the current step type (${currentStep.type}), provide a natural, encouraging response and guide the conversation according to these rules:
    - If step is "name": Acknowledge their name and ask about their interests
    - If step is "interests": Explore their mentioned interests and ask about their learning goals
    - If step is "goals": Discuss their goals and ask about their preferred learning style
    - If step is "learning_style": Acknowledge their style and open the conversation for any questions
    - If step is "open": Engage in open discussion while maintaining educational focus
    
    Keep responses concise, friendly, and focused on education.`;
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
  currentStep = 0;
  messagesContainer.innerHTML = '';
  initializeChat();
}

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
