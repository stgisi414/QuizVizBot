
const API_KEY = "AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA";
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

let chatHistory = [];
let currentStep = 0;
let isOnboardingComplete = false;
let courseFramework = null;

const MessageTypes = {
  ONBOARDING: 'onboarding',
  INSTRUCTIONAL: 'instructional',
  DATA_VIZ: 'd3_visualization',
  QUIZ: 'quiz'
};

const surveyFlow = {
  currentStep: 0,
  steps: [
    { type: "name", required: true },
    { type: "interests", required: true },
    { type: "goals", required: true },
    { type: "learning_style", required: true },
    { type: "summary", required: true }
  ]
};

function determineMessageType(message) {
  if (!isOnboardingComplete) return MessageTypes.ONBOARDING;
  // Add logic to determine message type based on content/context
  if (message.toLowerCase().includes('quiz')) return MessageTypes.QUIZ;
  if (message.toLowerCase().includes('visualize')) return MessageTypes.DATA_VIZ;
  return MessageTypes.INSTRUCTIONAL;
}

function generateCourseFramework(chatHistory) {
  const framework = {
    studentName: '',
    interests: [],
    goals: [],
    learningStyle: '',
    recommendedTopics: [],
    difficulty: 'intermediate'
  };
  
  // Extract information from chat history
  chatHistory.forEach(msg => {
    if (!msg.isUser) return;
    // Add logic to populate framework based on chat responses
  });
  
  return framework;
}

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

  const messageType = determineMessageType(userMessage);
  const currentStep = surveyFlow.steps[surveyFlow.currentStep] || { type: "open" };
  
  let promptTemplate = '';
  
  if (messageType === MessageTypes.ONBOARDING) {
    if (isFirstMessage) {
      promptTemplate = 
    `You are an educational AI assistant conducting a personalized learning journey. Provide a warm, engaging welcome message that introduces yourself and asks for the user's name. Keep it concise and friendly.` :
    `You are an educational AI assistant conducting an onboarding assessment.
    Current step type: ${currentStep.type}
    Previous conversation: ${contextMessages}
    User message: ${userMessage}
    
    Based on the current step (${currentStep.type}), provide a natural response following these rules:
    - If step is "name": Extract their name and ask about specific interests in technology and learning
    - If step is "interests": Note their interests and ask about specific learning goals
    - If step is "goals": Document their goals and ask about preferred learning style (visual, practical, theoretical)
    - If step is "learning_style": Note their style and prepare to summarize
    - If step is "summary": Provide a summary of their profile and indicate onboarding is complete
    
    If this is the summary step, also analyze the conversation to suggest 3-5 specific topics to learn.`;
  } else if (messageType === MessageTypes.INSTRUCTIONAL) {
    promptTemplate = `You are an educational AI assistant providing instructional guidance.
    Course Framework: ${JSON.stringify(courseFramework)}
    Previous conversation: ${contextMessages}
    User message: ${userMessage}
    
    Provide focused educational guidance based on their course framework and current topic.`;
  } else if (messageType === MessageTypes.QUIZ) {
    promptTemplate = `You are an educational AI assistant administering a quiz.
    Course Framework: ${JSON.stringify(courseFramework)}
    Previous conversation: ${contextMessages}
    User message: ${userMessage}
    
    Provide a multiple-choice question related to their current topic with 4 options.`;
  } else {
    promptTemplate = `You are an educational AI assistant providing data visualization guidance.
    Course Framework: ${JSON.stringify(courseFramework)}
    Previous conversation: ${contextMessages}
    User message: ${userMessage}
    
    Provide guidance on visualizing the discussed concept using D3.js.`;
  }
    
    Keep responses concise, friendly, and focused on education.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptTemplate }]
        }]
      })
    });
    const data = await response.json();
    const botResponse = data.candidates[0].content.parts[0].text;
    
    if (messageType === MessageTypes.ONBOARDING && currentStep.type === "summary") {
      isOnboardingComplete = true;
      courseFramework = generateCourseFramework(chatHistory);
      localStorage.setItem('courseFramework', JSON.stringify(courseFramework));
    }
    
    if (messageType === MessageTypes.ONBOARDING) {
      surveyFlow.currentStep++;
    }
    
    return botResponse;
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
