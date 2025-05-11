
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
    
    if (msg.type === 'quiz') {
      const quizData = JSON.parse(msg.text);
      messageDiv.innerHTML = `
        <div>${quizData.question}</div>
        <div class="quiz-options">
          ${quizData.options.map((option, index) => `
            <div class="quiz-option" onclick="checkAnswer(${index}, ${quizData.correct}, this)">
              ${option}
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const messageContent = document.createElement('div');
      messageContent.textContent = msg.text;
      messageDiv.appendChild(messageContent);
      
      if (!msg.isUser && msg.type === MessageTypes.INSTRUCTIONAL && isOnboardingComplete) {
        const actionButtons = document.createElement('div');
        actionButtons.className = 'message-actions';
        actionButtons.innerHTML = `
          <button onclick="requestVisualization()" class="icon-button"><i class="fas fa-chart-bar"></i></button>
          <button onclick="requestQuiz()" class="icon-button"><i class="fas fa-question-circle"></i></button>
        `;
        messageDiv.appendChild(actionButtons);
      }
    }
    
    messagesContainer.appendChild(messageDiv);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function checkAnswer(selected, correct, element) {
  const options = element.parentElement.children;
  Array.from(options).forEach(opt => opt.onclick = null);
  
  if (selected === correct) {
    element.classList.add('correct');
    addMessage("Correct! Well done!", false);
  } else {
    element.classList.add('incorrect');
    options[correct].classList.add('correct');
    addMessage("Incorrect. The correct answer is highlighted.", false);
  }
}

async function requestVisualization() {
  const promptTemplate = `Generate visualization data in this exact JSON format:
  {
    "type": "bar",
    "title": "Sample Data",
    "data": [
      {"label": "A", "value": 10},
      {"label": "B", "value": 20}
    ],
    "xAxis": "Categories",
    "yAxis": "Values"
  }`;
  
  const botResponse = await getBotResponse(promptTemplate, false);
  try {
    const vizData = JSON.parse(botResponse);
    const container = document.createElement('div');
    container.className = 'visualization-container';
    
    const width = 400;
    const height = 300;
    const margin = {top: 40, right: 20, bottom: 60, left: 60};
    
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    const x = d3.scaleBand()
      .domain(vizData.data.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.1);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(vizData.data, d => d.value)])
      .nice()
      .range([height - margin.bottom, margin.top]);
    
    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text(vizData.title);
    
    // Add bars
    svg.selectAll('rect')
      .data(vizData.data)
      .join('rect')
      .attr('x', d => x(d.label))
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => y(0) - y(d.value))
      .attr('fill', 'steelblue');
    
    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 40)
      .attr('fill', 'black')
      .attr('text-anchor', 'middle')
      .text(vizData.xAxis);
    
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -(height / 2))
      .attr('fill', 'black')
      .attr('text-anchor', 'middle')
      .text(vizData.yAxis);
    
    addMessage(container.outerHTML, false, MessageTypes.DATA_VIZ);
  } catch (error) {
    console.error('Visualization error:', error);
    addMessage("Sorry, there was an error generating the visualization.", false);
  }
}

async function requestQuiz() {
  const botResponse = await getBotResponse("Generate a quiz question for the current topic", false);
  try {
    const quizData = JSON.parse(botResponse);
    addMessage(JSON.stringify(quizData), false, 'quiz');
  } catch (error) {
    addMessage("Sorry, there was an error generating the quiz.", false);
  }
}

// Initialize chat with welcome message
async function initializeChat() {
  const date = new Date().toLocaleString();
  const welcomeMessage = await getBotResponse(`Current date and time: ${date}`, true);
  addMessage(welcomeMessage, false);
}

initializeChat();

function addMessage(message, isUser, type = MessageTypes.INSTRUCTIONAL) {
  chatHistory.push({ text: message, isUser, type });
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
    promptTemplate = isFirstMessage ? 
      `You are an educational AI assistant conducting a personalized learning journey. Using the current date and time (${userMessage}), provide a warm, engaging welcome message that introduces yourself and asks for the user's name. Include a time-appropriate greeting (good morning/afternoon/evening). Keep it concise and friendly.` :
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

// Text selection handling
let selectionPopup = null;

document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
  
  if (selectedText && messagesContainer.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    selectionPopup = document.createElement('div');
    selectionPopup.className = 'selection-popup';
    selectionPopup.innerHTML = `
      <button onclick="useSelectedText('${selectedText.replace(/'/g, "\\'")}')" class="icon-button">
        <i class="fas fa-paste"></i>
      </button>
    `;
    
    selectionPopup.style.top = `${rect.bottom + window.scrollY + 10}px`;
    selectionPopup.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(selectionPopup);
  }
});

function useSelectedText(text) {
  userInput.value = text;
  userInput.focus();
  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
}

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
